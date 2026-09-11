# Feature: Split APK / App Bundle Installer

## Objective

Implement a production-ready **Split APK / App Bundle Installer** in **droid.or**, extending the existing single-`.apk` installation workflow to support:

- `.apks` archives
- `.xapk` archives
- `.apkm` archives
- Directories containing multiple APK files

The feature must allow users to inspect a split APK set, understand its package/components, validate that the set is internally consistent, and install it safely to a **non-rooted Android device** over USB using ADB's native:

```text
adb install-multiple -r <base.apk> <split1.apk> <split2.apk> ...
```

Do **not** implement shell-based installation, root operations, system-partition modification, or any mechanism that implies permanent removal of Android system packages.

---

# Existing Architecture

Assume droid.or is a cross-platform desktop application built with:

- Vue 3
- Vite
- Electron
- Pinia
- Naive UI
- SQLite
- ADB
- `yauzl` for ZIP processing
- Zod for IPC validation

The application follows these architectural principles:

1. **Strictly non-root**
   - Operate within the capabilities of standard ADB / Android package-management APIs.
   - Installation must target the connected Android user's normal package manager.
   - Never require or attempt root.

2. **Hardened Electron security**
   - `contextIsolation: true`
   - `sandbox: true`
   - No arbitrary shell execution.
   - IPC payloads must be validated using existing Zod schemas.
   - ADB operations must use the application's existing typed client abstraction.
   - `RealAdbClient` must continue to construct commands as hardcoded `string[]` argv arrays rather than interpolated shell strings.

3. **Local-first**
   - Package inspection and archive extraction happen locally.
   - Do not upload APKs or archives to external services.
   - Installation history should remain in local SQLite.

4. **Safety-conscious UX**
   - Clearly distinguish inspection from installation.
   - Validate the complete APK set before installation.
   - Show meaningful warnings for suspicious, incomplete, incompatible, or ambiguous sets.
   - Use the application's existing confirmation patterns.

---

# Functional Requirements

## 1. Input Sources

The installer must accept three types of input.

### A. `.apks`

Treat `.apks` as a ZIP archive containing APK files, commonly including:

```text
base-master.apk
split_config.arm64_v8a.apk
split_config.xxhdpi.apk
split_config.en.apk
...
```

The implementation must not assume exact filenames.

Discover APK files by inspecting the archive entries.

### B. `.xapk`

Support `.xapk` ZIP archives.

An `.xapk` may contain APK files plus metadata such as:

```text
manifest.json
xapk.json
icon.png
*.obb
```

For the initial implementation:

- Extract and inspect APK files.
- Parse available XAPK metadata when useful.
- Do not automatically install OBB files unless the existing droid.or architecture already has an explicit, safe OBB-installation mechanism.
- Clearly indicate when an archive contains additional non-APK payloads that are not being installed.

### C. `.apkm`

Support `.apkm` ZIP archives.

Discover APK entries dynamically rather than depending on a particular naming convention.

### D. Directory of APKs

Allow the user to select a directory containing:

```text
*.apk
```

Recursively or non-recursively according to the existing file-selection conventions.

For safety and predictability, default to **non-recursive** directory scanning unless the existing application already defines recursive package discovery.

Ignore unrelated files.

---

# 2. Archive Inspection

Archive processing must happen in the Electron **main process**, not in the renderer.

Use the existing ZIP infrastructure (`yauzl`) rather than introducing another ZIP implementation.

### Security requirements

Never blindly extract an archive.

Reject or safely ignore:

- path traversal entries such as `../../foo.apk`
- absolute paths
- malformed ZIP entries
- duplicate destination paths
- unexpected filesystem locations
- excessively large extraction targets
- invalid filenames

Use a newly created application-controlled temporary directory for each inspection/install session.

Never extract directly into an arbitrary user-selected directory.

### Extraction strategy

Prefer streaming extraction from `yauzl`.

Only extract files that are required for APK inspection or installation.

Do not extract:

- icons
- arbitrary metadata
- OBB files
- unrelated archive content

unless specifically required by the feature.

Clean up temporary files after the operation finishes or fails.

Ensure cleanup also occurs on cancellation/error paths.

---

# 3. APK Discovery and Classification

After extraction/discovery, inspect every APK.

Determine:

- APK filename
- absolute temporary path
- file size
- package name
- version code
- version name, when available
- split name, if present
- whether it is the base APK
- ABI / architecture configuration, when available
- language configuration, when available
- density configuration, when available
- SDK constraints, when available
- manifest/application metadata relevant to installation
- cryptographic/signing information if the existing APK inspection layer supports it

The implementation should reuse existing APK parsing/inspection infrastructure where possible.

Do not duplicate package-manifest parsing logic unnecessarily.

---

# 4. Base APK Detection

A split APK set must contain exactly one installable base APK.

Determine the base APK from package metadata rather than relying solely on filename.

Typical Android split metadata should be treated as authoritative.

If the APK set contains:

- zero base APKs → block installation
- more than one base APK → block installation
- exactly one base APK → continue validation

Display the detected base APK prominently in the UI.

Example:

```text
Base APK
app-release.apk
com.example.app
Version 12.4.1 (120401)
```

---

# 5. Package Consistency Validation

Before allowing installation, validate that all APKs belong to the same package.

For example:

```text
base.apk                  com.example.foo
split_config.arm64.apk    com.example.foo
split_config.en.apk       com.example.foo
```

is valid.

But:

```text
base.apk                  com.example.foo
other.apk                 com.example.bar
```

must be rejected.

### Required validation

All APKs must have compatible:

- package name
- version code
- signing identity
- Android package metadata required for a coherent split installation

Where metadata cannot be safely established, report the limitation rather than pretending validation succeeded.

---

# 6. Split Classification

Present the discovered APKs in a structured UI.

For example:

| Type | APK | Configuration |
|---|---|---|
| Base | base.apk | Base |
| ABI | split_config.arm64_v8a.apk | arm64-v8a |
| Density | split_config.xxhdpi.apk | xxhdpi |
| Language | split_config.de.apk | de |

Classification should be metadata-driven.

Do not classify files solely from names such as `arm64`, `hdpi`, or `en`.

Filename heuristics may be used as a fallback for display only, never as the authoritative installation decision.

---

# 7. Device Compatibility

Before installation, query the connected device using the existing ADB abstraction.

Use existing device/package APIs where available.

Collect relevant information such as:

- Android SDK version
- supported ABIs
- device density
- installed package/version, if applicable
- current Android user where the application already models this concept

Use this information to identify obvious incompatibilities.

Examples:

```text
Warning:
The selected APK set contains only x86_64 native libraries,
but this device reports arm64-v8a support.
```

or:

```text
Compatible:
Device supports arm64-v8a and the APK set contains an arm64-v8a split.
```

Do not reject an APK set merely because the application cannot prove compatibility.

Different Android packaging configurations can be valid for reasons that are not fully inferable from simple heuristics.

Distinguish:

- **Error** — installation must be blocked
- **Warning** — user may continue
- **Informational** — no action required

---

# 8. Installation Command

Installation must use Android's native multi-APK installation mechanism.

The effective command is:

```text
adb install-multiple -r <base.apk> <split1.apk> <split2.apk> ...
```

Integrate this into the existing `AdbClient` abstraction.

Do **not** invoke:

```text
shell
sh -c
bash -c
cmd /c
powershell
```

or any equivalent shell wrapper.

The implementation must preserve the existing hardened argv architecture.

Conceptually:

```ts
[
  "install-multiple",
  "-r",
  baseApkPath,
  ...splitApkPaths,
]
```

Paths must remain individual argv elements.

Never construct a command string such as:

```ts
`adb install-multiple -r ${files.join(" ")}`
```

---

# 9. ADB Client API

Extend the existing ADB abstraction with a typed operation similar to:

```ts
installMultipleApks(
  apkPaths: string[],
  options?: {
    reinstall?: boolean;
  }
): Promise<AdbInstallResult>
```

The exact API should follow the project's existing naming and result conventions.

Requirements:

- validate inputs
- require at least one APK
- preserve deterministic ordering
- put the base APK first
- prevent renderer-controlled arbitrary ADB arguments
- expose structured success/failure information
- capture stdout/stderr through the existing ADB process abstraction
- support cancellation if the current ADB architecture supports cancellation

Do not expose a generic:

```ts
runAdb(args: string[])
```

IPC endpoint to the renderer merely to implement this feature.

The renderer should request a **specific typed operation**.

---

# 10. Deterministic APK Ordering

The final APK argument list must always be deterministic.

Recommended ordering:

1. Base APK
2. ABI splits
3. Density splits
4. Language splits
5. Other splits

If Android accepts the supplied order without semantic significance, ordering is primarily for:

- reproducibility
- logging
- testing
- debugging
- predictable history

Do not infer that ordering changes Android's split selection semantics.

---

# 11. Existing Installation Handling

Use:

```text
-r
```

to replace/reinstall an existing installation where Android permits it.

If installation fails because of:

- downgrade
- incompatible signatures
- missing required splits
- incompatible package
- insufficient storage
- device policy restrictions
- unsupported APK configuration

surface the actual Android/ADB error in a user-friendly form.

Do not attempt unsafe automatic workarounds.

For example, do not automatically uninstall an existing application simply because `install-multiple -r` failed.

---

# 12. Renderer UX

Add a new installer experience while preserving the existing single-APK workflow.

Suggested entry points:

```text
Install APK
Install Split APK Set
```

or a unified:

```text
Install application
```

that accepts:

- `.apk`
- `.apks`
- `.xapk`
- `.apkm`
- APK directories

Prefer whichever pattern best matches the current droid.or UI.

Use Naive UI components consistent with the existing application.

---

# 13. Suggested Installation Flow

### Step 1 — Select

User selects:

```text
foo.apks
```

### Step 2 — Inspect

Show:

```text
Inspecting archive…

Found 5 APK files
```

### Step 3 — Analyze

Display:

```text
Package
com.example.foo

Version
12.4.1 (120401)

APK set
1 Base
1 ARM64 split
1 xxhdpi split
2 Language splits
```

### Step 4 — Validate

Show a validation summary:

```text
✓ Same package
✓ Same version
✓ One base APK
✓ Signing identity consistent
✓ Device connected
✓ Device architecture compatible

Ready to install
```

### Step 5 — Confirmation

Before installation show:

```text
Install this application to the connected device?

Package:
com.example.foo

Version:
12.4.1

APK files:
5

The application will be installed/reinstalled for the
connected Android user using the standard Android package
installer.

[Cancel] [Install]
```

Do not use a destructive/critical typed confirmation merely because the operation is an installation, unless that matches an existing droid.or policy.

### Step 6 — Install

Display progress:

```text
Installing split APK set…
```

ADB output should be normalized into useful progress/status information where possible.

### Step 7 — Result

Success:

```text
Installation successful

com.example.foo
Version 12.4.1

5 APK components installed.
```

Failure:

```text
Installation failed

INSTALL_FAILED_MISSING_SPLIT

The selected APK set is incomplete for this installation.
```

---

# 14. Archive Metadata

For `.xapk` and `.apkm`, inspect metadata where available.

Metadata must be treated as **untrusted input**.

Never trust archive metadata over the actual APK manifests.

For example, if:

```text
manifest.json
```

claims package:

```text
com.example.foo
```

but the APK manifest says:

```text
com.example.bar
```

the APK metadata is authoritative and the discrepancy should be reported.

Do not execute or interpret arbitrary metadata as code.

---

# 15. File Validation

Before installation:

- verify every selected file exists
- verify every file is readable
- verify file extension/type
- inspect APK structure
- reject malformed APKs
- verify there is exactly one base APK
- verify package consistency
- verify version consistency
- verify signing consistency when available
- ensure all paths are inside the controlled temporary extraction directory or are explicitly selected APK files
- ensure there are no duplicate APKs in the final install set

Do not rely solely on `.apk` extensions for validity.

---

# 16. Temporary Storage

Use the application's existing temporary-file utilities if available.

Otherwise create a dedicated temporary directory such as:

```text
<app-temp>/split-install/<random-session-id>/
```

Never derive temporary paths directly from an archive filename.

The extraction path must be generated by the application.

Cleanup must happen:

- after successful installation
- after failed installation
- after inspection cancellation
- when the window/process is closed, where practical
- during application startup for stale temporary sessions

Avoid deleting user-selected source files.

---

# 17. IPC Security

Add dedicated typed IPC contracts.

For example:

```ts
splitInstaller.inspect
splitInstaller.install
```

or equivalent project naming.

Validate all incoming renderer data with Zod.

The renderer must not be able to provide:

```ts
[
  "install-multiple",
  "--some-arbitrary-flag",
  "..."
]
```

Instead, expose structured input such as:

```ts
{
  sessionId: string
}
```

or another controlled domain-specific request.

The main process owns:

- archive extraction
- APK discovery
- manifest inspection
- temporary paths
- validation
- ADB command construction
- installation

The renderer owns:

- presentation
- user interaction
- displaying inspection results
- requesting operations through typed IPC

---

# 18. Pinia State

Add a dedicated store or extend the existing installer store.

Suggested state:

```ts
type SplitInstallStatus =
  | "idle"
  | "selecting"
  | "extracting"
  | "inspecting"
  | "validating"
  | "ready"
  | "installing"
  | "success"
  | "error";
```

Store structured inspection data rather than raw command strings.

Example conceptual model:

```ts
interface SplitApkInfo {
  path: string;
  fileName: string;
  size: number;
  packageName: string;
  versionCode: number;
  versionName?: string;
  splitName?: string;
  type: "base" | "abi" | "density" | "language" | "feature" | "other";
}
```

And:

```ts
interface SplitInstallAnalysis {
  sourceType: "apks" | "xapk" | "apkm" | "directory";
  packageName?: string;
  versionCode?: number;
  versionName?: string;
  baseApk?: SplitApkInfo;
  splits: SplitApkInfo[];
  warnings: string[];
  errors: string[];
  canInstall: boolean;
}
```

Adapt these structures to existing domain models rather than blindly introducing duplicate representations.

---

# 19. SQLite History

Extend installation history so split installations are distinguishable from single APK installations.

Record, where the existing schema supports it:

- timestamp
- package name
- version code/name
- source type
- source filename
- number of APK components
- base APK filename
- split filenames
- target device identifier using the application's existing device-reference/privacy model
- result
- sanitized error information where applicable

Do not store entire APK contents.

Do not store unnecessary sensitive device information.

If the existing history schema supports extensible metadata, prefer that over a disruptive schema redesign.

Add a migration if a schema change is necessary.

---

# 20. Logging

Provide useful structured diagnostic logging.

Example:

```text
split-install: archive inspected
split-install: discovered 5 APK entries
split-install: base APK identified
split-install: package consistency validated
split-install: device compatibility checked
split-install: starting install-multiple
split-install: installation succeeded
```

Never log:

- arbitrary APK contents
- private user files
- unnecessary absolute source paths
- authentication material
- unrestricted command strings

If ADB command logging already exists, preserve its existing redaction conventions.

---

# 21. Error Mapping

Create a small domain-level error mapping layer for common Android installation errors.

Examples:

| ADB / Android Error | User-facing Meaning |
|---|---|
| `INSTALL_FAILED_MISSING_SPLIT` | Required split APK is missing |
| `INSTALL_FAILED_INVALID_APK` | One or more APK files are invalid |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Existing installation has an incompatible signature |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | Selected version is older than the installed version |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | APK native code is incompatible with the device |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` | Device does not have enough storage |
| `INSTALL_PARSE_FAILED_*` | Android could not parse one of the APKs |

Keep the original ADB error available in a technical-details section.

Do not fabricate an error classification when the actual error is unknown.

---

# 22. Testing Requirements

Add automated tests at the appropriate existing test layers.

## Unit tests

Test:

- `.apks` discovery
- `.xapk` discovery
- `.apkm` discovery
- directory discovery
- ZIP path traversal rejection
- duplicate entries
- base APK detection
- multiple-base rejection
- missing-base rejection
- package mismatch
- version mismatch
- deterministic ordering
- metadata discrepancy handling
- unsupported/non-APK archive entries
- temporary directory lifecycle

## ADB client tests

Verify that:

```ts
installMultipleApks(...)
```

produces argv equivalent to:

```text
[
  "install-multiple",
  "-r",
  "/tmp/base.apk",
  "/tmp/split_config.arm64_v8a.apk",
  "/tmp/split_config.en.apk"
]
```

Explicitly test filenames containing spaces and shell metacharacters.

For example:

```text
My App.apk
$(touch hacked)
foo;bar.apk
```

must remain individual argv values and must never be interpreted by a shell.

## IPC tests

Verify:

- invalid Zod payloads are rejected
- renderer cannot inject arbitrary ADB arguments
- installation requires a valid inspection/session
- invalid sessions cannot access arbitrary filesystem paths

## Integration tests

Where practical, test against:

- a valid multi-APK set
- an incomplete split set
- an incompatible ABI set
- an existing compatible installation
- an incompatible existing signature
- a malformed archive

Avoid requiring a physical Android device for ordinary unit tests.

---

# 23. UX Safety Rules

The UI must never claim:

> "System APK permanently deleted"

or anything equivalent.

This feature is an **application installer**, not a system modification mechanism.

The installer should explicitly communicate that installation occurs through Android's standard package-management mechanism.

If the target application is already installed, explain that `-r` requests a reinstall/update rather than silently suggesting a fresh installation.

---

# 24. Accessibility and UX Quality

Ensure:

- keyboard-accessible file selection
- readable status/error messages
- clear visual distinction between errors and warnings
- loading states during archive inspection
- disabled installation controls while validation is incomplete
- no accidental double-install from repeated clicks
- sensible empty states
- long filenames can be inspected without breaking layout
- technical ADB errors are available without overwhelming ordinary users

---

# 25. Performance

Avoid loading complete APKs or archives into renderer memory.

Use streaming ZIP access.

Prefer metadata inspection before extraction wherever possible.

For large split APK sets:

- process files incrementally
- avoid unnecessary copies
- avoid duplicate extraction
- avoid sending large binary data through IPC

IPC should transmit metadata and controlled identifiers/paths only.

---

# 26. Implementation Constraints

Do not:

- introduce root requirements
- execute shell commands
- interpolate user-controlled paths into shell strings
- expose generic command execution IPC
- upload APKs to external services
- silently uninstall applications
- modify `/system`
- modify `/vendor`
- modify `/product`
- bypass Android package-manager validation
- trust XAPK/APKM metadata over APK manifests
- use filename heuristics as authoritative package metadata
- extract archives outside controlled temporary directories
- leave temporary APKs indefinitely
- duplicate existing APK/ADB parsing infrastructure without first checking for reusable services

---

# 27. Expected Deliverables

Implement the feature end-to-end, including:

1. Domain models/types
2. Zod validation schemas
3. Main-process archive inspection/extraction
4. APK discovery and classification
5. Package/split validation
6. Device compatibility analysis
7. Typed ADB `install-multiple` operation
8. Secure IPC handlers/preload exposure
9. Pinia state management
10. Vue/Naive UI installer interface
11. Installation progress/result handling
12. SQLite history integration/migration where required
13. Structured logging
14. Error mapping
15. Unit tests
16. IPC/security tests
17. ADB argument-construction tests
18. Integration tests where practical

Follow the existing project's directory structure, naming conventions, error-handling patterns, IPC architecture, database conventions, and UI design rather than creating parallel frameworks.

---

# Definition of Done

The feature is complete when a user can select:

```text
application.apks
```

and droid.or can:

1. Safely inspect the archive locally.
2. Extract only the required APK files into a controlled temporary directory.
3. Discover the base APK and all relevant splits.
4. Display package/version/split information.
5. Validate package, version, base APK, and signing consistency.
6. Check obvious device compatibility constraints.
7. Clearly distinguish errors from warnings.
8. Ask for user confirmation.
9. Install using the equivalent of:

```text
adb install-multiple -r <base.apk> <split1.apk> <split2.apk> ...
```

10. Never invoke a shell or arbitrary command execution.
11. Show a clear success/failure result.
12. Record the installation in local history.
13. Clean up temporary extracted files.
14. Pass the relevant automated security, unit, IPC, and ADB tests.

The resulting implementation should feel like a **native extension of droid.or**, not a separate installer subsystem.