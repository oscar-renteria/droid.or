import type { RiskLevel } from '@shared/validation/analyzer.schema'

export interface PackageRiskEntry {
  risk: RiskLevel
  reason: string
  potentialImpact: string
}

/**
 * Curated, deliberately partial — the same honesty rule as the known-name
 * table: a package absent here gets a conservative heuristic default
 * (risk-classifier.ts), never a guessed specific reason. Every entry below
 * is a widely-documented, well-established case, not a guess about an
 * unfamiliar package's purpose. Expanding this table (and eventually an
 * AI/web-assisted provider) is exactly the kind of thing later milestones
 * are for — this is the always-available, no-network local baseline.
 */
export const PACKAGE_RISK_DATABASE: ReadonlyMap<string, PackageRiskEntry> = new Map([
  // --- Critical: core AOSP / GMS framework, present on virtually every device ---
  [
    'android',
    {
      risk: 'critical',
      reason: 'The core Android framework package itself.',
      potentialImpact: 'The device will not function at all.'
    }
  ],
  [
    'com.android.systemui',
    {
      risk: 'critical',
      reason: 'Provides the status bar, navigation bar, lock screen, and quick settings.',
      potentialImpact: 'The device becomes unusable — no way to navigate or unlock the screen.'
    }
  ],
  [
    'com.android.settings',
    {
      risk: 'critical',
      reason: 'The Settings app itself.',
      potentialImpact: 'No way to change any device setting, including undoing this change.'
    }
  ],
  [
    'com.android.providers.settings',
    {
      risk: 'critical',
      reason: 'Backing storage for every system setting.',
      potentialImpact: 'The device is very likely to fail to boot correctly.'
    }
  ],
  [
    'com.android.phone',
    {
      risk: 'critical',
      reason:
        'Core telephony service (calls, cellular state). Some OEMs use a differently-named package for this, so its absence here does not mean a device has no equivalent.',
      potentialImpact: 'Phone calls and cellular connectivity stop working.'
    }
  ],
  [
    'com.android.providers.media',
    {
      risk: 'critical',
      reason: 'Indexes and serves all photos, videos, and audio to every app on the device.',
      potentialImpact: 'Photos, the Gallery, and any app that reads media files stop working.'
    }
  ],
  [
    'com.android.providers.media.module',
    {
      risk: 'critical',
      reason: 'Indexes and serves all photos, videos, and audio to every app on the device.',
      potentialImpact: 'Photos, the Gallery, and any app that reads media files stop working.'
    }
  ],
  [
    'com.android.externalstorage',
    {
      risk: 'critical',
      reason: "Exposes the device's file storage to every other app.",
      potentialImpact: 'File managers and any app that opens or saves files stop working correctly.'
    }
  ],
  [
    'com.android.bluetooth',
    {
      risk: 'critical',
      reason: 'The entire Bluetooth stack.',
      potentialImpact: 'Bluetooth stops working device-wide (headphones, watches, car audio, etc.).'
    }
  ],
  [
    'com.android.nfc',
    {
      risk: 'critical',
      reason: 'The entire NFC stack.',
      potentialImpact: 'NFC-based payments and tap-to-pair stop working device-wide.'
    }
  ],
  [
    'com.google.android.gms',
    {
      risk: 'critical',
      reason:
        'Google Play Services — the runtime most apps on a GMS device depend on for push notifications, location, sign-in, and more.',
      potentialImpact:
        'A very large fraction of installed apps will crash or lose core functionality.'
    }
  ],
  [
    'com.google.android.gsf',
    {
      risk: 'critical',
      reason: 'Google Services Framework — required by Google Play Services to function at all.',
      potentialImpact: 'Anything depending on Google Play Services stops working.'
    }
  ],
  [
    'com.android.permissioncontroller',
    {
      risk: 'critical',
      reason: 'Manages every app permission grant/revoke on the device.',
      potentialImpact: 'Apps may lose the ability to request or be granted permissions correctly.'
    }
  ],
  [
    'com.google.android.permissioncontroller',
    {
      risk: 'critical',
      reason: 'Manages every app permission grant/revoke on the device.',
      potentialImpact: 'Apps may lose the ability to request or be granted permissions correctly.'
    }
  ],
  [
    'com.android.packageinstaller',
    {
      risk: 'critical',
      reason: 'Handles installing and uninstalling every APK on the device.',
      potentialImpact: 'Installing, updating, or uninstalling any app stops working.'
    }
  ],
  [
    'com.google.android.packageinstaller',
    {
      risk: 'critical',
      reason: 'Handles installing and uninstalling every APK on the device.',
      potentialImpact: 'Installing, updating, or uninstalling any app stops working.'
    }
  ],

  // --- Advanced: real, understood trade-offs, but not "safe for most users" ---
  [
    'com.android.vending',
    {
      risk: 'advanced',
      reason: 'The Play Store app.',
      potentialImpact:
        'The device keeps working, but installing or updating apps through the Play Store stops working.'
    }
  ],

  // --- Caution: legitimate manufacturer/Google features some people rely on ---
  [
    'com.google.android.gm',
    {
      risk: 'caution',
      reason: "Google's default email client.",
      potentialImpact:
        'Safe to disable if you use a different email app; otherwise you lose Gmail access.'
    }
  ],
  [
    'com.samsung.android.bixby.agent',
    {
      risk: 'caution',
      reason: "Samsung's Bixby voice assistant.",
      potentialImpact:
        'Bixby (including the side/power button shortcut, on devices that have one) stops working.'
    }
  ],
  [
    'com.samsung.android.bixby.wakeup',
    {
      risk: 'caution',
      reason: 'Bixby wake-word detection.',
      potentialImpact:
        '"Hi Bixby" voice activation stops working; the Bixby app itself is unaffected.'
    }
  ],
  [
    'com.samsung.android.oneconnect',
    {
      risk: 'caution',
      reason: "Samsung's SmartThings hub app for smart-home devices.",
      potentialImpact:
        'Any SmartThings-paired device (locks, sensors, plugs) loses its control app.'
    }
  ],
  [
    'com.samsung.android.spay',
    {
      risk: 'caution',
      reason: 'Samsung Wallet / Samsung Pay.',
      potentialImpact: 'Tap-to-pay through Samsung Wallet stops working.'
    }
  ],
  [
    'com.google.android.apps.tachyon',
    {
      risk: 'caution',
      reason: 'Google Meet.',
      potentialImpact: 'Safe to disable if you use a different video-calling app.'
    }
  ],
  [
    'com.microsoft.skydrive',
    {
      risk: 'caution',
      reason:
        'Microsoft OneDrive, often preinstalled as part of a Samsung/Microsoft bundling deal.',
      potentialImpact: 'Safe to disable if you do not use OneDrive for backup or file sync.'
    }
  ],

  // --- Safe: well-documented bloat with no real functional loss for most users ---
  [
    'com.samsung.android.aremoji',
    {
      risk: 'safe',
      reason: 'Provides Samsung AR Emoji functionality.',
      potentialImpact:
        'AR Emoji features stop working; core camera, calling, and system functions are unaffected.'
    }
  ],
  [
    'com.facebook.system',
    {
      risk: 'safe',
      reason:
        'A background Facebook SDK service preinstalled by some OEMs/carriers, not the Facebook app itself.',
      potentialImpact: 'No visible functionality loss for most users.'
    }
  ],
  [
    'com.facebook.services',
    {
      risk: 'safe',
      reason:
        'A background Facebook SDK service preinstalled by some OEMs/carriers, not the Facebook app itself.',
      potentialImpact: 'No visible functionality loss for most users.'
    }
  ],
  [
    'com.facebook.appmanager',
    {
      risk: 'safe',
      reason:
        'Manages background updates for preinstalled Facebook components outside the Play Store.',
      potentialImpact: 'No visible functionality loss for most users.'
    }
  ]
])
