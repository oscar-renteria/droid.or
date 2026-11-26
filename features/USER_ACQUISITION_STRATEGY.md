# droid.or — User Acquisition & Distribution Strategy

**Version:** 1.1 (revised 2026-11-25, after the v1.0.0 release)
**Goal:** Measurable growth in downloads, stars and returning users in the
first 90 days after v1.0.0, without compromising the project's no-telemetry
promise.
**Positioning:** _Install split APK bundles (.apks / .xapk / .apkm) and copy
apps from one phone to another — from your computer, over USB, without root.
Open source, no telemetry._

---

## 0. What changed in this revision

| Area | v1.0 assumption | Reality (checked against the repo) | Consequence |
| :--- | :--- | :--- | :--- |
| Metrics | "Growing active installs" | No telemetry by design; active installs cannot be measured. | KPIs now use public proxies (§2). |
| Debloat | "Community profiles", "crowdsourced OEM JSON/YAML profiles" | Three fixed risk-tier profiles in `src/renderer/src/utils/debloat-profiles.ts`; package knowledge is a TypeScript map in `src/main/android/package-risk-database.ts`. No per-OEM profile format exists. | Debloat is a secondary message, not a hero feature. A contribution format is a product task, not a marketing one (§7). |
| Competition | Debloat positioned on par with UAD-NG | UAD-NG has a far larger, community-maintained package list. | Lead with the split-bundle installer and phone-to-phone transfer, where droid.or is differentiated. |
| Privacy claim | "Local-only, zero cloud dependencies" | True by default, but there is an opt-in "Ask AI" feature (Anthropic / OpenAI-compatible) and a daily update check. | Privacy wording must say "no telemetry; network only on explicit action, plus an opt-out update check" (as `README.md` does). |
| Community | GitHub Discussions as feedback loop | Discussions are disabled. | Enable before any launch post. |
| Repo metadata | — | 0 stars; homepage URL points to the Releases page. | Landing page + social proof are launch prerequisites. |
| Reddit | r/sideloaded as a target | r/sideloaded is about iOS sideloading. | Removed. |
| Market data | "Over 70% of desktop sideloaders run Windows" | No source. | Removed. Windows-first remains a reasonable **assumption**. |
| Trust | Not addressed | Windows and macOS builds are unsigned; SmartScreen/Gatekeeper warnings on first start. | Biggest conversion leak for non-technical users (§3.4). |

---

## 1. Principles

1. **Readiness before reach.** A launch post gets one spike. Landing page,
   demo GIF, Discussions and a clean first-start experience must exist
   _before_ the spike, otherwise the traffic is wasted.
2. **Lead with differentiators.** Split-bundle install and phone-to-phone
   transfer have few open-source desktop alternatives. Debloating is a
   crowded field.
3. **Honest claims only.** Every public claim must be verifiable in the repo
   (no telemetry, MIT, no root, tested Android 10–16). Overclaiming in
   privacy communities is punished quickly and permanently.
4. **Compounding over one-off.** Package managers and search-targeted guides
   keep bringing users; Reddit/HN posts do not.
5. **One maintainer's capacity.** Every channel creates support load. Prefer
   few channels done well over many done poorly.

---

## 2. Measurement (no telemetry)

| KPI | Source | How |
| :--- | :--- | :--- |
| Downloads per release and asset | GitHub Releases API (`download_count`) | `gh api repos/oscar-renteria/droid.or/releases` |
| Repo views / unique visitors / referrers | GitHub Traffic API | **Only 14 days retained** — must be snapshotted regularly (script or scheduled workflow). |
| Stars, forks, watchers | GitHub API | Weekly snapshot |
| Engagement | Issues, Discussions, PRs from non-maintainers | Weekly count |
| Package-manager installs | winget/Scoop: not public; AUR: votes/popularity; Flathub: public install stats | Per channel, where available |

**Baseline (2026-11-25, `npm run metrics`):** 0 stars, 8 downloads of
v1.0.0, 1 repository view in the last 14 days.
**90-day targets (assumptions, adjust after week 4):** 1,000 total release
downloads, 100 stars, 10 issues/discussions from external users, listed in at
least 3 package managers.

Use per-channel links where the platform allows it (e.g. distinct landing
page anchors or `?ref=` on the landing page) to attribute spikes; GitHub's
referrer list covers the rest.

---

## 3. Pillar 1 — Launch readiness (prerequisites)

### 3.0 Document the hero-feature tests
Split/bundle install and copy-between-devices have been tested on real
phones by the maintainer. `ANDROID_COMPATIBILITY.md` still lists both as
"Not yet" verified on real hardware. Update it with the tested devices
before launch: the landing page and launch posts link to it, and readers
will take the outdated "Not yet" at face value.

### 3.1 Landing page (GitHub Pages)
- Single page: one-sentence pitch, demo GIF, download buttons per OS,
  "Is it safe?" section (no telemetry, MIT, checksums, provenance), links to
  guides.
- Set it as the repository homepage URL (currently the Releases page).

### 3.2 Demo media
- 20–30 s GIF/MP4 for each hero flow: bundle install, phone-to-phone
  transfer. Requires real devices — maintainer task.
- Reuse in README, landing page, every launch post.

### 3.3 Feedback channel
- Enable GitHub Discussions (categories: Q&A, Device reports, Ideas).
- Add a "Report your device" discussion template feeding
  `ANDROID_COMPATIBILITY.md`.

### 3.4 First-start trust
- Unsigned builds trigger SmartScreen (Windows) and Gatekeeper (macOS).
  The release notes explain the workaround; also put it on the landing page
  directly next to the download buttons.
- **Option:** apply for free OSS code signing (e.g. SignPath Foundation for
  Windows). Eligibility criteria and lead time need to be verified. Highest
  impact on Windows conversion, but not a blocker for launch.

### 3.5 In-app
- The About dialog already links to GitHub Sponsors. Add a "Star on GitHub /
  report an issue" link there. No nag dialogs, no prompts on start.

---

## 4. Pillar 2 — Distribution channels (compounding)

Ordered by expected value per effort. Effort and acceptance criteria marked
"verify" have not been checked against the current rules of each registry.

| # | Channel | Effort | Notes / risks |
| :- | :--- | :--- | :--- |
| 1 | **Own Scoop bucket** (in this repo or `scoop-droid-or`) | Low | Fully under our control. Scoop Extras has notability requirements (verify); apply there later with stars. |
| 2 | **winget** (`microsoft/winget-pkgs`) | Low–medium | NSIS installer supports silent install (`/S`). Unsigned installers can be accepted but may be flagged by automated validation (verify). Automate updates later with `wingetcreate` + a PAT secret. |
| 3 | **AUR `droid-or-bin`** (AppImage) | Low | Needs an AUR account and SSH key. Maintenance: one bump per release. |
| 4 | **AlternativeTo** | Low | Manual web submission. List as alternative to: Split APKs Installer (SAI), ADB AppControl, Samsung Smart Switch, UAD-NG (secondary). Do not list scrcpy (complementary, not an alternative). |
| 5 | **Homebrew** | Medium | homebrew/cask is phasing out casks that fail Gatekeeper (to our knowledge; verify current policy). The app is only ad-hoc signed → use an **own tap** (`oscar-renteria/homebrew-tap`) instead. macOS is experimental anyway; low priority. |
| 6 | **Flathub** | High | Needs sandbox USB/device access for ADB, native module (`better-sqlite3`), and the platform-tools download conflicts with sandboxing expectations. Defer until demand appears in issues. |

Release workflow follow-up: generate manifests/PKGBUILD from the release
`SHA256SUMS.txt` automatically so package managers never lag a release.

---

## 5. Pillar 3 — Community launch (one-time spikes)

Rules for all posts: maintainer voice, problem first, honest limits (no app
data transfer, unsigned builds, macOS experimental), no cross-posting on the
same day, stay available for 24 h after each post to answer questions.
**Check each community's current self-promotion rules before posting** —
several Android subreddits restrict or ban developer self-promotion outside
dedicated threads.

| Order | Channel | Angle |
| :- | :--- | :--- |
| 1 | **XDA Forums** (Android Software and Hacking General) | Full feature thread with screenshots, SHA256, provenance; becomes the long-lived support thread. |
| 2 | **r/androidapps** (only if desktop tools are allowed; otherwise its self-promo thread) | "Open-source desktop tool to install .apks/.xapk/.apkm and copy apps between phones over USB, no root." |
| 3 | **Show HN** | `Show HN: droid.or – install split APK bundles and copy apps between Android phones over USB`. Technical angle: split selection by ABI/density/locale, atomic `adb install-multiple`, Electron security model. |
| 4 | **r/degoogle / r/privacy** | Only after 1–3 went well. Angle: local, no telemetry, sideloading without third-party installer apps. Debloat as secondary point; mention the opt-in AI feature proactively. |
| 5 | **r/opensource, r/linux** (AppImage) | Short "I built" posts; low priority. |

---

## 6. Pillar 4 — Search-targeted guides (compounding)

Publish on the landing page (and mirror in `docs/guides/`). Each guide solves
the problem first (including manual ADB commands), then shows droid.or as the
faster path. That makes them useful even to people who never install the
app, which is what gets them linked and ranked.

1. How to install .xapk / .apks / .apkm files from a PC (with and without
   droid.or).
2. How to copy an installed app from one Android phone to another without
   root — including the limits (no app data, Play licensing checks).
3. How to extract base and split APKs from a phone to a computer.
4. How to safely disable preinstalled apps without root, and how to undo it.

---

## 7. Pillar 5 — Ecosystem & community flywheel

1. **Newsletters:** Android Weekly (dev/QA angle), Console.dev, It's FOSS /
   FOSS Weekly. Submit after the landing page and demo exist.
2. **Creators:** Short, personal pitch with the demo video to mid-size
   Android customization/privacy channels. Low hit rate — do it once, after
   launch feedback has been incorporated.
3. **Device compatibility reports:** Discussions template → maintainer
   verifies → listed in `ANDROID_COMPATIBILITY.md` with credit.
4. **Package knowledge contributions:** Today this means PRs to
   `package-risk-database.ts`. Add a `good first issue` label and a short
   contribution guide for entries (source required per entry). A data-file
   format for per-OEM lists is a separate product decision.
5. **Release notes:** Keep them human-readable; every release is a reason to
   post an update in the XDA thread and Discussions.

---

## 8. Execution plan

Owner: **R** = repository work (code, docs, config; reviewed and merged by
the maintainer), **M** = maintainer action (accounts, settings, real
devices, posting).

```
Week 1 — Readiness
├── [x] R  Landing page (site/) + Pages workflow (.github/workflows/pages.yml)
├── [ ] M  Settings → Pages → Source: GitHub Actions; set repo homepage URL
├── [x] M  Enable GitHub Discussions; add category "Device reports"
│          (slug device-reports) so .github/DISCUSSION_TEMPLATE/ applies
├── [x] R  Discussion templates (device report, Q&A)
├── [x] R  About dialog: "Star on GitHub / Report an issue" links
├── [x] R  Metrics snapshot script (npm run metrics)
├── [ ] M  Record split install + phone-to-phone copy test devices in
│          ANDROID_COMPATIBILITY.md (§3.0)
└── [ ] M  Record demo GIFs (bundle install, phone transfer)

Week 2 — Package managers
├── [ ] R  Scoop bucket manifest in repo        → M: announce in README
├── [ ] R  winget manifest (YAML, v1.0.0)        → M: PR to winget-pkgs
├── [ ] R  AUR PKGBUILD droid-or-bin             → M: push to AUR
└── [ ] M  AlternativeTo listing

Week 3 — Launch
├── [ ] R  Draft posts: XDA, Reddit, Show HN     → M: review & post
├── [ ] M  XDA thread
├── [ ] M  r/androidapps (if allowed)
└── [ ] M  Show HN

Week 4+ — Compounding
├── [ ] R  4 guides (§6)
├── [ ] R  Release workflow: auto-generate package manifests
├── [ ] M  Newsletter submissions, creator outreach
├── [ ] M  Evaluate SignPath / code signing
└── [ ] M  Review KPIs vs. targets; drop channels without traction
```

---

## 9. Risks

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Unsigned builds scare off Windows users | Lower conversion from every channel | Clear landing-page instructions; evaluate free OSS signing. |
| A user bricks/loses functionality after debloating and posts about it | Reputation damage in exactly the target communities | Keep debloat secondary in messaging; point to Recovery; respond publicly and quickly. |
| Self-promotion rule violations | Post removed, account flagged | Read rules first; use designated threads. |
| Support load after launch spikes | Slow responses → negative impressions | Stagger launches; issue templates; Troubleshooting doc linked everywhere. |
| Package managers lag behind releases | Users stuck on old versions | Automate manifest generation in the release workflow. |
| Trademark: "Android" in names/titles | Takedown requests | Keep the existing non-affiliation notice; never use Android logos as the app icon. |
