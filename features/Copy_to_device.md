# Feature: Copy app to another device

Status: **implemented** (plan v2, then an independent code review). Branch: `feature/copy_to_device`.

## Goal

Copy an installed app from one connected device (the source) to another connected device (the target) in one flow. droid.or pulls every APK file the source holds for the package (the base APK and all its splits), checks the set against the target, and installs it there with `adb install-multiple`.

The motivating case is an app that the Play Store refuses to install in the user's region, such as `com.citibanamex.banamexmobile` for a German account, while another phone already has it. Copying only `base.apk` fails with `INSTALL_FAILED_MISSING_SPLIT`.

## Non-goals and hard limits

- **App data is not transferred.** Without root, the only way to copy another app's data is `adb backup`, which is deprecated and which most apps opt out of, banking apps especially. The UI says this plainly.
- **The installer source is not faked.** droid.or does not pass `-i com.android.vending`. Apps that use Play's automatic integrity protection, or that check Play Integrity themselves, can install fine and still refuse to start ("Get this app from Play"). The UI names this risk; droid.or does not work around it.
- **Only the source device's splits.** The source holds exactly the splits Play delivered to it. If the target needs something the source doesn't have (another CPU architecture), the existing split analysis blocks the install.
- **No progress events in v1.** Pulling about 100 MB takes seconds over USB and can take a minute or more over wireless adb. `PULL_TIMEOUT_MS` (120 s) applies to each file, so a very large base APK over Wi-Fi can time out. This is a known limitation.

## Design decisions (from the plan review)

1. **Install every pulled file; offer no part toggles.** The split panel's default selection (`computeDefaultSelectedFileNames`) deselects ABI and density splits that don't match the device. Applied to a transfer, it would drop the source's only density split when the two screens differ. A base APK built by bundletool with `isSplitRequired`/`requiredSplitTypes` then fails with the very `INSTALL_FAILED_MISSING_SPLIT` this feature exists to avoid. The source already holds a minimal set, so all of it is installed.
2. **Pull a second time on perform, then verify.** No server-side state is kept between IPC calls (the same rule the split installer follows). `perform` therefore stages the files again and runs `buildSplitInstallAnalysis` on that fresh copy. It refuses the install if:
   - `!canInstall`,
   - the package name differs from the requested one, or
   - the version code differs from the `expectedVersionCode` the user saw, which happens if the app updated on the source in the meantime.

   This also fills a gap: `performSplitInstall` checks neither `canInstall` nor the package name.
3. **The history entry names the source.** `performSplitInstall` gets an optional `historyNote` that is prefixed to `rawOutput`, for example "Copied from samsung SM-F766B (R5CY…)". The operation type stays `split-install`, so no enum or History UI changes are needed.
4. **Path rule.** Every path from `pm path`, after `path.posix.normalize`, must start with `/data/app/` or match `/mnt/expand/<uuid>/app/` (adopted storage). Anything else is refused, for example `/product/app/…` (Gmail) or `/system/…`. The UI also hides the action for system apps (`isSystemApp`). That is the primary gate; the path rule is the server-side backstop.
5. **The dialog locks the source.** `sourceDeviceId` is captured when the dialog opens instead of read live from the sidebar. Changing the target clears the analysis (the store tracks `analyzedSourceId`/`analyzedTargetId`).

## Design

### Main: `src/main/android/device-transfer.service.ts`

- `stagePackageFromDevice(adb, sourceSerial, packageName)` → `{ dir }`
  1. Validates `isValidPackageName`, then runs `pm path`. An empty result means "not installed on the source device".
  2. Applies the path rule (decision 4) and refuses duplicate basenames.
  3. Creates a temp dir with `mkdtemp(tmpdir()/SPLIT_INSTALL_TEMP_DIR_PREFIX)` (the stale sweeper at startup covers crash leftovers) and pulls each file as `basename(path)`. On any failure it removes the dir and rethrows.
- `analyzeDeviceTransfer(adb, source, target, packageName, parseApk?)`
  1. Refuses `source === target`.
  2. Stages, then runs `buildSplitInstallAnalysis(adb, target, 'directory', [dir])`.
  3. Removes the dir in `finally`.
- `performDeviceTransfer(db, adb, source, target, packageName, expectedVersionCode, historyNote, parseApk?)`
  1. Stages and analyzes again, then applies the guards from decision 2.
  2. Calls `performSplitInstall(…, 'directory', [dir], allFileNames, parseApk, historyNote)`.
  3. Removes the dir in `finally`.

### IPC

- Channels:
  - `AnalyzeDeviceTransfer = 'transfer:analyze'`
  - `PerformDeviceTransfer = 'transfer:perform'`
- `src/shared/validation/device-transfer.schema.ts`:
  - `analyze`: `{ sourceDeviceId, targetDeviceId, packageName }`, with a `.refine` that source ≠ target.
  - `perform`: the same fields plus `expectedVersionCode: int | null`.
- Responses reuse `splitInstallAnalysisSchema` and `operationResultSchema`.
- `device-transfer.handler.ts`:
  - Requires both devices to be connected and authorized and checks `isValidPackageName`.
  - Builds `historyNote` from the registry's device info.
  - Holds one in-flight lock keyed by `source:target:package`, covering analyze and perform, so a double click doesn't start two parallel pulls.
- Preload methods validate with Zod; `DroidorApi` is extended.

### Renderer

- `stores/device-transfer.store.ts`:
  - State: `analysis`, `analyzedSourceId`, `analyzedTargetId`, `loading`, `errorMessage`, `installing`, `result`.
  - Actions: `analyze()`, `confirm()`, `reset()`.
- `components/CopyToDeviceDialog.vue` (modelled on `BackupDialog.vue`):
  1. Target picker: connected and authorized devices other than the source. If there are none: "Connect a second device to copy this app."
  2. A warning about app data and Play integrity protection.
  3. "Check compatibility" shows "Copying files from the source device…", then the plan tag, version, issues (the same alert style as the split panel) and the file list (name, role, size). No temp paths are shown.
  4. "Copy & install N file(s)" is enabled only when `canInstall` is true. While it runs it shows "Copying and installing on the target…", then the result alert.
- `AppsView.vue`: a "Copy to device…" button in the drawer's Actions, only for non-system apps.

## Tests

- `FakeAdbClient` gets `pullWritesFiles` (opt-in), which writes a placeholder file to `localPath`, so the real `stat`/discovery path runs.
- `tests/main/android/device-transfer.service.test.ts`:
  - Happy path: every file is pulled from the **source**, analysis runs against the **target**'s ABI, and the staging dir is gone afterwards.
  - Refusals: source = target, empty `pm path`, and system/product paths or `..` traversal. A path on adopted storage is accepted.
  - A failed pull removes the dir and throws.
  - Perform: `install-multiple` runs on the **target** with all pulled files, and the history entry contains the note.
  - Perform refuses a version-code mismatch, a package-name mismatch and `!canInstall`, without calling install.
  - If `install-multiple` throws, the dir is still removed.
- `tests/renderer/stores/device-transfer.store.test.ts`: analyze/confirm/error paths, and a target change invalidates the analysis.

## Review outcome

An independent review found no bug that installs onto the wrong device, leaks the temp dir or drops files. Fixed after the review:

- The dialog cleared the target while a transfer was running when that device dropped off briefly, which hid the result. It now keeps the selection while busy or once a result exists.
- A stale IPC response could overwrite the state of a newer request after a reset (for example when the dialog remounted). The store now ignores responses from before the last reset (generation counter).
- `expectedVersionCode === null` let the source-update check pass without guarding anything. An unreadable version code is now refused.

Known limitations (accepted for v1):

- `pm path` queries user 0 only. An app installed only in a work profile or secondary user is reported as "not installed".
- A downgrade on the target is only a warning, the same as in the split installer. Android rejects the install with a clear message.
- The "Copy to device…" button is hidden for updated system apps, even though their files are under `/data/app`.
- Perform parses every APK twice (verifying analysis, then `performSplitInstall`).

## Done criteria

`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run test` are green, and an independent review finds no open correctness issue. Verifying on a real device (the Banamex case) is left to the owner.
