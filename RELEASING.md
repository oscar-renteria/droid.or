# Releasing

How a maintainer publishes a new version. The pipeline does the building;
these steps decide what goes out and check it before anyone can download it.

## Versions

Versions follow [SemVer](https://semver.org). On the way to a stable
release they go through prereleases:

| Stage             | Example        | Purpose                        |
| ----------------- | -------------- | ------------------------------ |
| Beta              | `1.0.0-beta.4` | Pipeline and feature testing   |
| Release candidate | `1.0.0-rc.1`   | QA on real machines and phones |
| Stable            | `1.0.0`        | Public release                 |

A tag with a `-` (beta, rc) becomes a GitHub **prerelease**. Prereleases
never trigger the in-app "Update" button, because GitHub's latest-release
endpoint ignores them. Only stable releases reach existing users that way.

## 1. Prepare the version on a branch

`master` only accepts changes through pull requests with green CI, so the
version bump is a small pull request of its own:

```bash
git switch master && git pull
git switch -c release/1.0.0-rc.1
npm version 1.0.0-rc.1 --no-git-tag-version   # updates package.json and package-lock.json
```

Then update [`CHANGELOG.md`](CHANGELOG.md): move the entries under
**Unreleased** into a new section for this version with today's date, and
update the comparison links at the bottom. Commit, push, open a pull request,
and merge it once CI is green.

## 2. Tag the merged commit

```bash
git switch master && git pull
git tag -a v1.0.0-rc.1 -m "droid.or 1.0.0-rc.1"
git push origin v1.0.0-rc.1
```

**Tags are permanent.** A ruleset protects `v*` tags: they can be created
but never moved or deleted. If a tag turns out to be wrong, don't try to
reuse it; fix the problem and release the next version number (for example
`1.0.0-rc.2`).

## 3. Let the release workflow run

Pushing the tag starts **Actions → Release** (`.github/workflows/release.yml`):

1. **Verify** checks the tag is a SemVer version equal to `package.json`'s
   version, then runs type-checking, lint, `format:check` and the tests.
2. **Build** packages Windows, Linux and macOS and launches each package
   once (`--smoke-test`). A failing macOS job doesn't stop the release,
   because macOS is experimental.
3. **Publish** writes `SHA256SUMS.txt`, creates a signed build provenance
   attestation for every file, and creates a **draft** release.

If a job fails for a temporary reason (a runner or network problem), use
**Re-run failed jobs** on the same run. If the code or configuration needs
a change, merge the fix and release the next version number.

## 4. Check the draft

Open the draft on the
[Releases page](https://github.com/oscar-renteria/droid.or/releases). It's
only visible to maintainers until published.

- It has five files: `…-x64-setup.exe`, `…-x64-portable.exe`,
  `…-x86_64.AppImage`, `…-arm64.dmg` (missing if the macOS job failed) and
  `SHA256SUMS.txt`.
- Prereleases are marked **Pre-release**; stable versions are not.
- The notes start with the download and first-start instructions from
  `.github/release-template.md`, followed by GitHub's generated list of
  merged pull requests. Add a short summary of what changed at the top,
  taken from `CHANGELOG.md`.
- Download at least one file and verify it:

  ```bash
  sha256sum --check --ignore-missing SHA256SUMS.txt
  gh attestation verify droid.or-1.0.0-rc.1-x86_64.AppImage --repo oscar-renteria/droid.or
  ```

  (`gh attestation` needs GitHub CLI 2.49 or newer.)

- Start the downloaded app once and connect a phone.

If anything is wrong, delete the draft (drafts can be deleted; the tag
stays) and release the next version number once fixed.

## 5. Publish

Click **Publish release**. For a stable version, keep **Set as the latest
release** ticked: from then on, installed copies of droid.or show an
"Update" button within a day.

After a release candidate, the QA steps in
[`features/ROADMAP_TO_PRODUCTION.md`](features/ROADMAP_TO_PRODUCTION.md)
(Phase 7) decide whether it becomes the stable release.
