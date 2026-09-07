/**
 * Friendly names for well-known packages. There is no ADB shell command
 * that resolves an app's real label (confirmed by inspecting `dumpsys
 * package` output directly — it never contains the resolved string, only
 * internal type/resource references), so this is a deliberately partial,
 * hand-curated table rather than a claim of full coverage. It's biased
 * toward the packages that are least readable on their own: AOSP/system
 * internals, Google apps, and common OEM/user apps. An unlisted package
 * simply falls back to its raw package name — never guessed or invented.
 */
export const KNOWN_PACKAGE_NAMES: ReadonlyMap<string, string> = new Map([
  // AOSP / core system
  ['com.android.systemui', 'System UI'],
  ['com.android.settings', 'Settings'],
  ['com.android.vending', 'Play Store'],
  ['com.android.chrome', 'Chrome'],
  ['com.android.dialer', 'Phone'],
  ['com.android.contacts', 'Contacts'],
  ['com.android.mms', 'Messages'],
  ['com.android.camera2', 'Camera'],
  ['com.android.gallery3d', 'Gallery'],
  ['com.android.documentsui', 'Files'],
  ['com.android.calculator2', 'Calculator'],
  ['com.android.deskclock', 'Clock'],
  ['com.android.carrierdefaultapp', 'Carrier Default Setup'],
  ['com.android.bluetooth', 'Bluetooth'],
  ['com.android.nfc', 'NFC Service'],
  ['com.android.printspooler', 'Print Spooler'],
  ['com.android.soundrecorder', 'Sound Recorder'],
  ['com.android.stk', 'SIM Toolkit'],

  // Google apps
  ['com.google.android.gm', 'Gmail'],
  ['com.google.android.gsf', 'Google Services Framework'],
  ['com.google.android.gms', 'Google Play Services'],
  ['com.google.android.youtube', 'YouTube'],
  ['com.google.android.apps.youtube.music', 'YouTube Music'],
  ['com.google.android.apps.maps', 'Maps'],
  ['com.google.android.apps.photos', 'Photos'],
  ['com.google.android.calendar', 'Calendar'],
  ['com.google.android.contacts', 'Contacts (Google)'],
  ['com.google.android.dialer', 'Phone (Google)'],
  ['com.google.android.googlequicksearchbox', 'Google App'],
  ['com.google.android.apps.docs', 'Google Drive'],
  ['com.google.android.apps.tachyon', 'Google Meet'],
  ['com.google.android.marvin.talkback', 'TalkBack'],
  ['com.google.android.accessibility.talkback', 'TalkBack'],
  ['com.google.android.apps.messaging', 'Messages (Google)'],
  ['com.google.android.apps.wellbeing', 'Digital Wellbeing'],
  ['com.google.android.apps.nbu.files', 'Files by Google'],
  ['com.google.android.deskclock', 'Clock (Google)'],
  ['com.google.android.inputmethod.latin', 'Gboard'],
  ['com.google.android.projection.gearhead', 'Android Auto'],
  ['com.google.android.apps.walletnfcrel', 'Google Wallet'],
  ['com.google.android.apps.chromecast.app', 'Google Home'],

  // Popular third-party apps
  ['com.whatsapp', 'WhatsApp'],
  ['com.facebook.katana', 'Facebook'],
  ['com.facebook.orca', 'Messenger'],
  ['com.instagram.android', 'Instagram'],
  ['com.spotify.music', 'Spotify'],
  ['com.netflix.mediaclient', 'Netflix'],
  ['org.mozilla.firefox', 'Firefox'],
  ['org.telegram.messenger', 'Telegram'],
  ['org.thoughtcrime.securesms', 'Signal'],
  ['com.zhiliaoapp.musically', 'TikTok'],
  ['com.twitter.android', 'X (Twitter)'],
  ['com.amazon.mShop.android.shopping', 'Amazon Shopping'],
  ['com.ubercab', 'Uber'],
  ['com.microsoft.office.outlook', 'Outlook'],
  ['com.microsoft.teams', 'Microsoft Teams'],
  ['us.zoom.videomeetings', 'Zoom'],
  ['com.discord', 'Discord'],
  ['com.dropbox.android', 'Dropbox'],
  ['com.paypal.android.p2pmobile', 'PayPal'],

  // Common Samsung apps
  ['com.samsung.knox.securefolder', 'Secure Folder'],
  ['com.samsung.android.app.smartcapture', 'Smart Capture'],
  ['com.samsung.android.messaging', 'Samsung Messages'],
  ['com.samsung.android.dialer', 'Samsung Phone'],
  ['com.samsung.android.contacts', 'Samsung Contacts'],
  ['com.samsung.android.app.camera', 'Samsung Camera'],
  ['com.samsung.android.gallery3d', 'Samsung Gallery'],
  ['com.sec.android.gallery3d', 'Samsung Gallery'],
  ['com.samsung.android.calendar', 'Samsung Calendar'],
  ['com.samsung.android.app.notes', 'Samsung Notes'],
  ['com.samsung.android.spay', 'Samsung Wallet'],
  ['com.samsung.android.email.provider', 'Samsung Email'],
  ['com.samsung.android.honeyboard', 'Samsung Keyboard'],
  ['com.samsung.android.smartswitchassistant', 'Smart Switch'],
  ['com.sec.android.app.shealth', 'Samsung Health'],
  ['com.sec.android.app.sbrowser', 'Samsung Internet'],
  ['com.samsung.android.mateagent', 'Galaxy Wearable'],
  ['com.samsung.android.oneconnect', 'SmartThings'],
  ['com.samsung.android.bixby.agent', 'Bixby'],
  ['com.samsung.android.app.reminder', 'Samsung Reminder']
])
