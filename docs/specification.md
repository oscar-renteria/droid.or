# Role

You are a senior software architect and full-stack desktop application engineer with deep expertise in:

* Electron
* Node.js
* TypeScript
* Vue 3
* Vite
* Android Debug Bridge (ADB)
* Android package management
* Cross-platform desktop applications
* Linux, macOS, and Windows
* Secure desktop application architecture
* UX/UI design for technical utilities

You are working inside a **VS Code development environment on Linux**.

Your task is to design and implement a production-quality, cross-platform Electron application for managing and debloating Android phones connected via USB.

The application should be technically robust, maintainable, well documented, and designed so that it can eventually be packaged for:

* Linux
* macOS
* Windows

The application must work with **non-rooted Android devices**. Root access must NOT be required for the core functionality.

---

# Main Goal

Build a desktop application (droid.or) that allows users to safely inspect, analyze, debloat, restore, and manage Android devices connected through USB using Android Debug Bridge (ADB).

The application should make potentially dangerous Android package-management operations understandable to normal users while still providing advanced functionality for experienced Android users.

The application should feel like a polished product, not a proof-of-concept.

Think of it as:

> "A professional Android device maintenance, debloating, and package-management tool for desktop users."

---

# Technology Stack

Use the following technology stack unless there is a compelling technical reason to deviate:

### Desktop

* Electron
* Node.js
* TypeScript

### Frontend

* Vue 3
* TypeScript
* Vite

### Android communication

* Android Debug Bridge (ADB)
* USB device detection
* ADB shell/package-management commands

### Recommended supporting technologies

You may choose appropriate libraries for:

* State management
* UI components
* Icons
* Persistent storage
* Logging
* Validation
* Testing
* Packaging
* IPC communication

Prefer mature, actively maintained libraries.

Do not introduce unnecessary dependencies.

---

# Important Architectural Requirement

Follow Electron security best practices.

The renderer process must NOT have unrestricted access to Node.js or the filesystem.

Use an architecture similar to:

```text
Electron Main Process
        |
        | IPC
        |
Preload / Secure API Bridge
        |
        |
Vue Renderer
```

Use:

* `contextIsolation: true`
* `nodeIntegration: false`
* a strictly controlled preload API
* validated IPC messages
* no unnecessary exposure of Node.js APIs to Vue

ADB operations should be performed from the appropriate privileged/main-process side rather than directly from the renderer.

Clearly separate:

1. UI
2. Application state
3. Android/ADB service
4. Package-management logic
5. Persistence
6. Analysis/recommendation engine
7. Backup/restore functionality
8. Logging

---

# Core Features

## 1. Android Device Detection

When an Android phone is connected through USB:

* Detect it automatically.
* Detect when it is disconnected.
* Display its connection state.
* Handle multiple connected devices if ADB supports them.
* Avoid accidentally sending commands to the wrong device.

The UI should clearly show:

* Connected
* Disconnected
* Unauthorized
* Offline
* Recovery/bootloader mode if detectable
* Multiple devices connected

If USB debugging is disabled, clearly explain how the user can enable it.

If the Android device displays an RSA authorization dialog, explain that the user needs to authorize this computer.

Never silently execute destructive commands on a newly connected device.

---

# 2. Device History

The application should remember every Android phone that has previously been connected.

Create a persistent left-side device panel.

For each device, display something useful such as:

* Device name
* Manufacturer
* Model
* Android version
* Last connected
* Connection status
* Optional user-defined nickname
* Device icon/avatar

Example:

```text
DEVICES

● Samsung Galaxy S23
  Android 15
  Connected

○ Pixel 8
  Android 16
  Last seen yesterday

○ Xiaomi 14
  Android 15
  Last seen 3 days ago
```

Do not rely exclusively on a potentially changeable model name for device identification.

Use an appropriate stable device identifier where possible, while considering privacy.

Allow users to:

* Rename devices
* Remove devices from history
* Clear device history

---

# 3. Device Dashboard

When a device is selected, the main/right panel should display a detailed dashboard.

Include information that can safely be obtained through ADB.

Potential information:

### Basic

* Manufacturer
* Model
* Device name
* Android version
* SDK/API level
* Build number
* Security patch level
* Kernel version
* Architecture (ARM64, ARM, x86, etc.)
* Bootloader status where available
* Root status
* USB debugging status

### Hardware

Where available:

* CPU architecture
* CPU cores
* RAM
* Storage capacity
* Free storage
* Battery percentage
* Battery temperature
* Battery health information if available
* Screen resolution
* Refresh rate if obtainable
* Display density
* Serial/device identifier where appropriate

### System

* Current uptime
* SELinux status
* Encryption status where obtainable
* A/B partition status
* System update information where available

Do not assume that every device exposes every property.

The UI should gracefully display:

> Not available

rather than failing.

---

# 4. Installed Applications

Provide a comprehensive application/package manager.

The user should be able to inspect installed packages.

For each package, display information such as:

* Application name
* Package name
* Version
* Version code
* Install source
* System app / user app
* Disabled/enabled
* APK path where obtainable
* UID where useful
* Approximate storage usage where obtainable
* First install/update information where available

Allow sorting and filtering.

Useful filters:

* All apps
* User apps
* System apps
* Disabled apps
* Recently installed
* Large apps
* Apps installed from Play Store
* Apps installed from unknown sources
* Packages with no visible launcher icon
* Packages recommended for removal
* Packages previously modified by this application

Provide search by:

* Application name
* Package name

---

# 5. Debloating

The central feature is safely removing or disabling unwanted packages.

However, understand an important limitation:

A non-rooted Android device generally does NOT allow arbitrary permanent deletion of system applications from the read-only system partition.

Therefore, design the application around the actual capabilities of ADB and Android package management.

Support operations such as:

* Disable package
* Uninstall package for the current user
* Restore/uninstall rollback where technically possible
* Clear application data/cache where appropriate
* Enable previously disabled packages

Do NOT falsely claim that a package has been permanently deleted if Android has only removed it for the current user.

Clearly explain the difference between:

> Disable

> Uninstall for user

> Remove/restore

> Factory/system package

The application should determine what operation is actually possible before presenting it as an option.

---

# 6. Safety Classification

Every installed package should receive a safety classification.

For example:

### 🟢 Safe / Low Risk

Generally safe to remove for most users.

### 🟡 Caution

Potentially removable but may affect a feature, manufacturer functionality, or another application.

### 🟠 Advanced

Removing or disabling may have significant side effects.

### 🔴 Critical

Do not recommend removal.

Critical packages may include components required for:

* Android System
* System UI
* Package Manager
* Settings
* Telephony
* Connectivity
* Permission management
* Core Google services
* Manufacturer-specific system infrastructure

Do NOT hard-code simplistic rules such as:

> "Everything containing Samsung is bloat."

Package analysis needs to consider:

* Package name
* Android version
* Manufacturer
* Device model
* System/user classification
* Dependencies where detectable
* Services provided
* Permissions
* Whether the package is currently running
* Whether other packages depend on it
* Known package databases
* Community knowledge
* Device-specific information

---

# 7. Android Debloat Analyzer

Create an analysis feature.

The user should be able to click:

> Analyze Device

The application analyzes installed packages and generates recommendations.

For each recommendation show:

```text
Samsung AR Emoji

com.samsung.android.aremoji

Risk: Low

Recommendation:
Safe to uninstall for most users.

Reason:
This package provides Samsung AR Emoji functionality.
Removing it should not affect core telephony, Wi-Fi,
Bluetooth, or Android system functionality.

Potential impact:
AR Emoji features will no longer work.

Actions:
[Uninstall for User]
[Disable]
[Ignore]
```

The user must always remain in control.

Never automatically uninstall applications based solely on an AI recommendation.

---

# 8. AI / Web-Assisted Analysis

Design the architecture so package analysis can optionally be enhanced by AI and/or web research.

This should be an abstraction rather than tightly coupling the entire application to one AI provider.

For example:

```text
PackageAnalysisProvider
        |
        +-- LocalRulesProvider
        |
        +-- KnowledgeBaseProvider
        |
        +-- AIProvider
        |
        +-- WebResearchProvider
```

The application should still work fully without internet access and without an AI API key.

Local analysis should be the fallback.

If AI/web analysis is enabled:

* Never send sensitive device identifiers unnecessarily.
* Do not upload personal files.
* Do not upload arbitrary device contents.
* Minimize transmitted information.
* Explain to the user what information is being sent.
* Allow the feature to be disabled.

The AI should receive information such as:

* Manufacturer
* Model
* Android version
* Package name
* App label
* Version
* Permissions
* System/user classification
* Relevant metadata

The AI should NOT be trusted blindly.

Treat AI output as:

> Recommendation / advisory information

rather than authoritative truth.

---

# 9. Package Details

Clicking an application should open a detailed package view.

Show:

* App name
* Package name
* Version
* Version code
* APK location
* UID
* Permissions
* Services
* Activities
* Receivers
* Providers where obtainable
* Whether it is currently running
* Installation state
* System/user app
* Disabled/enabled state
* Dependencies/reverse dependencies where detectable
* Risk classification
* Analysis explanation
* Previous actions performed by this application

Actions:

* Disable
* Enable
* Uninstall for user
* Restore
* Clear data
* Export APK where technically possible
* Install/update APK
* Add to ignore list

Dangerous actions should require confirmation.

---

# 10. Restore System

One of the most important requirements is recovery.

Before performing an operation, maintain a local history of what the application changed.

For example:

```text
Operation History

2026-09-07 18:32
Uninstalled for user:
com.example.app

2026-09-07 18:34
Disabled:
com.example.service
```

For every operation store:

* Device identifier
* Timestamp
* Package name
* Previous state
* New state
* Operation
* Relevant package metadata
* ADB command/result
* Success/failure

Provide:

> Restore

and:

> Restore Original State

The user should be able to restore:

* One application
* Multiple selected applications
* Everything modified by the application

IMPORTANT:

Do not promise restoration if Android's underlying package-management mechanism cannot provide it.

For example, if an APK is no longer available locally and cannot be restored through the normal Android package manager, explain the limitation.

Where appropriate, allow the application to preserve package/APK information that improves restoration.

---

# 11. Restore Original State

Create a dedicated recovery page:

```text
DEVICE RECOVERY

This device has been modified by Android Debloater.

Changes detected:
12 packages uninstalled
4 packages disabled
2 packages cleared

[Restore All Changes]

[Review Changes]
```

Before restoring everything:

* Show a summary
* Explain what will happen
* Ask for confirmation

Never perform a factory reset automatically.

Do not pretend that "Restore Original State" means a true factory image restoration.

Clearly distinguish:

> Restore changes made by this application

from:

> Factory reset

and:

> Firmware/system restoration

---

# 12. APK Installer

Provide a feature for installing APK files from the host computer.

Support:

* File picker
* Drag & drop
* APK installation through ADB
* Installation progress
* Success/failure reporting
* Package name detection where possible
* Version information
* Existing app detection
* Update vs fresh install

If possible, support:

* Multiple APK files
* Split APKs / APK sets where technically feasible
* `.apks` / `.xapk` formats only if a reliable implementation is available

Do not claim support for formats that are not actually implemented.

Before installation, display useful information about the APK.

---

# 13. APK Backup / Export

Consider implementing APK backup/export functionality.

Allow the user to preserve APKs before making changes when technically possible.

Example:

```text
Backup

☑ com.example.app
☑ com.example.service
☐ com.example.other

[Backup Selected]
```

Store backups in a user-selected directory.

Clearly explain that backing up an APK does not necessarily back up:

* Application data
* Accounts
* Encryption keys
* DRM
* Server-side data
* System state

---

# 14. Debloat Profiles

Add a powerful but safe concept called:

> Debloat Profiles

Examples:

* Minimal Debloat
* Recommended Debloat
* Aggressive Debloat
* Samsung Cleanup
* Xiaomi Cleanup
* Google Cleanup
* Privacy-Oriented
* Gaming
* Battery Optimization

Profiles should NEVER blindly remove packages.

Instead they should generate a reviewable list:

```text
Recommended Profile

23 packages recommended
7 packages caution
4 packages excluded as critical

[Review]
[Apply Selected]
```

The user must confirm before changes occur.

---

# 15. Ignore List

Allow users to mark packages as:

> Never recommend this package

This is useful because users may intentionally keep certain manufacturer apps.

---

# 16. Favorites / Important Apps

Allow users to mark applications as:

> Important

Important applications should receive stronger warnings before modification.

---

# 17. Dependency Awareness

Where technically feasible, analyze package relationships.

If application A depends on package B:

```text
⚠ Potential dependency

Removing this package may affect:

• Samsung Health
• Samsung Camera
• Samsung Gallery
```

Do not claim dependency information is complete if Android does not expose enough information to establish it reliably.

Clearly label inferred relationships.

---

# 18. Device Health

Add a useful device-health section.

Possible metrics:

* Battery level
* Battery temperature
* Storage usage
* RAM
* CPU information
* Thermal status if available
* Current uptime
* Number of installed packages
* Number of disabled packages
* Number of packages modified by the app

Potential dashboard:

```text
DEVICE HEALTH

Battery       82%
Temperature   31°C
Storage       112 / 256 GB
RAM           5.2 / 8 GB

Installed Apps       184
User Apps              71
System Apps           113
Disabled                8
Debloated              21
```

Only show metrics that can be obtained reliably.

---

# 19. Logs

Create a developer/user-accessible log viewer.

Show:

* Timestamp
* Device
* Operation
* ADB command category
* Result
* Error message
* Duration

Do not expose sensitive information unnecessarily.

Allow:

> Export Logs

for troubleshooting.

---

# 20. ADB Management

Do not assume ADB is installed.

Create an ADB abstraction layer capable of:

* Detecting installed ADB
* Detecting its version
* Allowing a configurable ADB executable path
* Reporting missing ADB
* Validating that the executable works

Consider whether the application should bundle platform-tools.

If bundling ADB, investigate licensing/distribution implications and platform-specific packaging requirements.

Do not download executable binaries from arbitrary websites.

---

# 21. Cross-Platform Design

The application must be designed for:

### Linux

* USB/udev considerations
* Permissions
* Distribution differences

### Windows

* ADB/USB driver considerations
* Windows Defender/firewall considerations where relevant

### macOS

* USB/device permissions
* Apple security restrictions
* Application signing/notarization considerations

Document platform-specific requirements.

Do not assume Linux behavior automatically works on Windows or macOS.

---

# 22. User Interface

Create a modern professional UI.

Suggested layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ Android Debloater                              Device: ●      │
├──────────────┬────────────────────────────────────────────────┤
│ DEVICES      │ DEVICE DASHBOARD                              │
│              │                                                │
│ ● Galaxy S23 │ Samsung Galaxy S23                            │
│   Android 15 │ Android 15                                    │
│              │                                                │
│ ○ Pixel 8    │ Battery     82%                              │
│   Android 16 │ Storage     112 / 256 GB                     │
│              │ RAM          5.2 / 8 GB                       │
│              │                                                │
│              │ [Overview] [Apps] [Analyzer] [History]        │
│              │                                                │
│              │ Installed Applications                         │
│              │ ┌──────────────────────────────────────────┐  │
│              │ │ Search packages...                       │  │
│              │ └──────────────────────────────────────────┘  │
│              │                                                │
│              │ Chrome                  System       🟢       │
│              │ Samsung AR Emoji        System       🟢       │
│              │ Example Service          System       🟡       │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

The UI should support:

* Dark mode
* Light mode
* Responsive layout
* Keyboard navigation
* Tooltips
* Clear error messages
* Loading states
* Empty states
* Confirmation dialogs
* Progress indicators

---

# 23. Dangerous Operation UX

This is extremely important.

Never make destructive operations too easy to trigger accidentally.

For example:

```text
⚠ UNINSTALL APPLICATION

You are about to uninstall this package for the
current Android user:

Samsung AR Emoji
com.samsung.android.aremoji

Potential impact:
AR Emoji functionality will stop working.

This operation can potentially cause unexpected
behavior if the package is required by another
component.

[Cancel]       [Uninstall]
```

For high-risk packages require an additional confirmation.

Consider requiring the user to type:

```text
UNINSTALL
```

for particularly dangerous operations.

---

# 24. Global Safety Warning

During first launch, show a clear disclaimer.

The application should explain that:

* Modifying Android packages can cause unexpected behavior.
* Some applications are required by the manufacturer or Android.
* The application cannot guarantee that every recommendation is safe.
* Users are responsible for their actions.
* The application is not responsible for data loss, device malfunction, boot loops, loss of functionality, or other damage.
* Users should maintain backups.
* Advanced operations should only be performed by users who understand the risks.

Do not make the disclaimer excessively legalistic or misleading.

The user should explicitly acknowledge the warning before using destructive functionality.

---

# 25. Technical Safety

Implement safeguards such as:

* Never execute arbitrary shell commands originating directly from UI input.
* Use predefined ADB operations.
* Validate package names.
* Escape/avoid shell injection.
* Prefer structured process arguments rather than shell strings.
* Validate device IDs.
* Explicitly target the selected device with ADB commands.
* Prevent operations when the device becomes disconnected.
* Detect unauthorized/offline devices.
* Prevent simultaneous conflicting operations.
* Maintain operation locks where appropriate.
* Verify operation results.
* Never report success solely because an ADB process exited without checking the result.

---

# 26. Error Handling

Design for real-world failures.

Examples:

* Phone disconnected during operation
* ADB unavailable
* USB debugging disabled
* Device unauthorized
* Package does not exist
* Package cannot be uninstalled
* Permission denied
* ADB timeout
* Android version incompatibility
* Multiple devices connected
* Device enters recovery mode
* APK installation failure
* Insufficient storage

Errors should be understandable to normal users.

Instead of:

```text
exit code 1
```

show:

```text
Android rejected this operation.

The package could not be removed for the current user.
The manufacturer may have protected this package.

Technical details:
ADB exit code: 1
```

Provide a way to inspect technical details.

---

# 27. Persistence

Use a suitable local persistence mechanism.

Persist:

* Device history
* Device nicknames
* Package modification history
* Restore information
* User preferences
* Ignore list
* Favorites
* Debloat profiles
* Application settings

Do not store unnecessary personal information.

Design the persistence layer so it can be migrated when the application schema changes.

---

# 28. Testing

Create a serious testing strategy.

Include:

### Unit tests

For:

* Package parsing
* ADB output parsing
* Device detection
* Package classification
* Risk calculation
* State management
* Persistence

### Integration tests

For:

* ADB service
* IPC
* Package-management workflows

### UI tests

For:

* Device selection
* Package filtering
* Confirmation dialogs
* Restore workflows
* Error states

Do not require a physical Android device for every test.

Create mocks/fakes for ADB.

For example:

```text
MockAdbService
FakeAndroidDevice
MockPackageManager
```

This should allow development on a Linux machine without a phone connected.

---

# 29. Project Structure

Use a clean project structure.

For example:

```text
src/
├── main/
│   ├── adb/
│   ├── android/
│   ├── packages/
│   ├── backup/
│   ├── analysis/
│   ├── persistence/
│   ├── ipc/
│   └── main.ts
│
├── preload/
│   └── preload.ts
│
├── renderer/
│   ├── components/
│   ├── views/
│   ├── stores/
│   ├── services/
│   ├── composables/
│   ├── types/
│   └── main.ts
│
└── shared/
    ├── types/
    ├── constants/
    └── validation/
```

You may modify this structure if you can provide a better architecture.

---

# 30. Development Approach

Do NOT attempt to generate the entire application blindly in one huge response.

Work incrementally.

First:

1. Analyze requirements.
2. Identify technical limitations.
3. Identify risky assumptions.
4. Propose architecture.
5. Propose project structure.
6. Propose dependencies.
7. Identify Android/ADB capabilities and limitations.
8. Define the MVP.
9. Define future features.
10. Explain important design decisions.

Then implement the application in logical milestones.

After each major milestone:

* Verify the code.
* Look for TypeScript errors.
* Look for architectural problems.
* Look for security problems.
* Look for race conditions.
* Look for platform-specific issues.
* Improve the implementation before continuing.

Do not simply generate code and assume it works.

---

# 31. Important Android Constraints

You must explicitly research and account for the differences between Android versions and manufacturers.

Do not assume that an ADB command that works on one device works on all Android devices.

Pay particular attention to:

* Android 10+
* Android 11+
* Android 12+
* Android 13+
* Android 14+
* Android 15+
* Android 16+
* Samsung One UI
* Xiaomi/HyperOS
* Google Pixel
* OnePlus/OxygenOS
* Oppo/ColorOS
* Vivo
* Motorola

The implementation should detect the environment where possible and adapt accordingly.

When an operation is unsupported, explain why.

---

# 32. No Root Requirement

The core application must work without root.

Clearly distinguish between:

### Supported without root

Operations that ADB normally allows for a non-rooted device.

### Requires additional privileges

Operations that may require root, special OEM privileges, unlocked bootloader, recovery mode, etc.

### Not supported

Operations that cannot safely or reliably be performed.

Do not design the application around root access.

A future plugin/advanced mode may potentially support rooted devices, but this should not complicate the initial architecture.

---

# 33. Security and Privacy

Treat the application as security-sensitive software.

The application interacts with a user's phone and potentially has powerful ADB capabilities.

Follow principles such as:

* Least privilege
* Secure IPC
* Input validation
* No arbitrary command execution
* No remote command execution
* No telemetry by default
* Minimal data collection
* Transparent network usage
* Local-first functionality

If AI/web analysis is implemented, make network requests explicit and configurable.

---

# 34. Documentation

Create excellent documentation.

At minimum:

```text
README.md
ARCHITECTURE.md
DEVELOPMENT.md
SECURITY.md
ADB.md
ANDROID_COMPATIBILITY.md
CONTRIBUTING.md
```

Document:

* Installation
* Development
* Building
* Packaging
* ADB setup
* Linux permissions
* Windows driver considerations
* macOS requirements
* Supported Android versions
* Known limitations
* Safety considerations
* Troubleshooting

---

# 35. Packaging

The final project should be capable of generating installers/packages for:

* Linux
* Windows
* macOS

Use an appropriate Electron packaging solution.

Configure:

* Application name
* Application ID
* Icons
* Versioning
* Build scripts

Keep platform-specific configuration isolated where possible.

---

# 36. UX Improvements

Be creative.

Think of additional functionality that would genuinely be useful to Android users.

Potential features include:

* Storage analyzer
* Battery analyzer
* Permission overview
* Privacy analyzer
* Startup/background-app analysis
* Recently installed apps
* Large-app detector
* Duplicate package detection
* Manufacturer bloatware detection
* Google bloatware detection
* App usage information where obtainable
* Package activity/service viewer
* ADB terminal for advanced users, but sandbox it carefully
* Device screenshots
* Screen recording
* File browser
* Device reboot controls
* Reboot into recovery/bootloader where appropriate
* Wireless ADB support
* Export device report
* Compare two devices
* Debloat recommendation history
* "What changed?" dashboard
* Before/after device statistics

However, do not allow feature creep to compromise the core application.

Prioritize features based on actual value and technical reliability.

---

# 37. Product Philosophy

The application should follow these principles:

### Safe by default

The application should favor:

> Inform → Analyze → Explain → Confirm → Execute → Verify

rather than:

> Click → Destroy

### Transparent

Users should understand:

* What will happen
* Why it is recommended
* What could break
* Whether the operation is reversible

### Local-first

Core functionality should not depend on cloud services.

### Advanced but approachable

A technically knowledgeable Android user should have powerful tools while a less experienced user should not be encouraged to blindly modify critical system packages.

---

# 38. Your First Task

Before writing significant amounts of code, produce a detailed technical proposal.

Include:

1. Recommended architecture
2. Electron process architecture
3. IPC design
4. Vue application architecture
5. ADB architecture
6. Android package-management strategy
7. Persistence strategy
8. Backup/restore strategy
9. AI/web-analysis architecture
10. Security model
11. Cross-platform strategy
12. Testing strategy
13. Recommended dependencies
14. Project structure
15. MVP feature list
16. Post-MVP feature list
17. Known Android limitations
18. Major technical risks
19. Proposed mitigations
20. Development milestones

For every important architectural decision, explain **why** you recommend it.

If you discover that any requested feature is technically impossible, unreliable, dangerous, or misleading on non-rooted Android devices, explicitly say so and propose the closest practical alternative.

Do not hide limitations simply to make the project sound easier.

---

# 39. Implementation Rules

When implementation begins:

* Use strict TypeScript.
* Avoid `any` wherever reasonably possible.
* Prefer typed interfaces and discriminated unions.
* Keep business logic out of Vue components.
* Keep ADB implementation out of the renderer.
* Keep IPC contracts strongly typed.
* Validate all IPC inputs.
* Use asynchronous APIs appropriately.
* Handle process cancellation/timeouts.
* Log failures appropriately.
* Do not swallow errors.
* Keep functions focused.
* Avoid giant files.
* Avoid duplicated logic.
* Write tests for critical functionality.
* Comment complex Android-specific behavior.
* Do not invent ADB capabilities.
* Do not invent Android APIs.
* Verify commands against actual Android/ADB behavior when possible.

When choosing between a clever implementation and a boring reliable implementation, choose the reliable implementation.

---

# 40. Final Objective

The end result should be a polished Electron desktop application that allows a user to:

1. Connect an Android phone through USB.
2. Detect and identify the phone.
3. Inspect detailed device information.
4. Browse installed packages.
5. Understand which applications are safe, risky, or critical.
6. Analyze the device for debloating opportunities.
7. Review recommendations.
8. Disable or uninstall supported packages without root.
9. Keep a complete record of changes.
10. Restore individual packages/states where possible.
11. Restore all changes made by the application where possible.
12. Install APK files from the computer.
13. Back up useful package information/APKs where technically possible.
14. Monitor device health.
15. Export diagnostic information.
16. Use optional AI/web-assisted package analysis.
17. Do all of this through a professional, modern, safe UI.

The application must be designed around **real Android and ADB capabilities**, not assumptions.

Start by giving me the technical proposal and architecture.

Do not begin by dumping hundreds of lines of code.

After I review the proposal, we will implement the project milestone by milestone.
