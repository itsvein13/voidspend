# Testing VOIDSPEND v2 on a real phone

19 November 2026. The emulator cannot prove several parts of v2, so this note says how to get a development build onto a phone and what to try on it. The build itself is a step for the owner: it uploads the project to Expo's servers and uses the build quota of the Expo account, and it was not run from here.

## What is ready

- `eas.json` already has a `development` profile (a development client, internal distribution, which gives an APK on Android). The project is linked (`@veingh0st/duitku`, the same id as in `app.json`) and `eas-cli` 18.13 is installed and logged in.
- `expo-dev-client` is installed, and `expo-notifications` was added with its config plugin.
- Autolinking was checked: the local module `receipt-scan` (ML Kit text recognition, `modules/receipt-scan`) is found at `modules/receipt-scan/android` and registers `expo.modules.receiptscan.ReceiptScanModule`, and `expo-notifications` is found too. This does not compile the Kotlin. The first build is the first time it is compiled, so it may fail on that module. If it does, send the end of the build log and it can be fixed.
- There is no JDK on this PC and the Android SDK has only platform 34, no NDK. A local build would mean installing a JDK, more SDK parts and a Gradle download, so the cloud build is the way.

## Build and install

The working tree has uncommitted changes. `eas build` would ask to commit them, so skip version control for the build:

```powershell
$env:EAS_NO_VCS = "1"
eas build --platform android --profile development
```

(After the changes are committed, the second line alone is enough.) What to expect:

1. It packs the project, honoring `.gitignore` (so `node_modules` and the generated `android` folder stay out), and uploads it.
2. If no Android signing key is stored for this project yet, it offers to create one. A key stored on Expo is also the one a release build will be signed with, so that is a decision, not a click.
3. The build runs in the cloud and can wait in a queue on the free plan. The page it prints shows the progress and, when done, a download link and a QR code.
4. On the phone, open that link, download the APK and allow installing from that source when Android asks. From a PC with the phone on USB, `adb install` with the downloaded file also works.

If the phone already has VOIDSPEND 1.x installed with the same package name, the new APK replaces it and keeps its data, but only when both are signed with the same key. A different key makes Android refuse ("App not installed"), and uninstalling to get past that deletes the v1 data. v2 writes a backup of the v1 data before it imports it, and shows a report.

## Run it

On the PC, in the project folder:

```powershell
npx expo start --dev-client
```

Open the "VOIDSPEND" development app on the phone and connect to the server by the QR code or the address. The phone and the PC must be on the same Wi-Fi. If the network blocks it, `npx expo start --dev-client --tunnel` goes around it.

## What to try

Each line says what should happen. Note anything that differs, with a screenshot, and what you did just before.

**The receipt reader (never run until now)**
- Scan at least five real receipts: a minimarket, a restaurant with tax and service, a fuel station, a coffee shop, and a faded one. Expected: the merchant, date, total and item lines are filled in, anything doubtful is marked, and nothing is saved before the review. Note which fields were wrong, because the parser was only tested on made-up receipts.
- "Take a photo" asks for the camera, and the photo reaches the review screen. "Choose from gallery" works.
- On the review screen, open the photo larger and pinch it with two fingers, drag it, double tap it, and use the Zoom in and Zoom out buttons.

**Place**
- "Use current location" shows the in-app explanation, then the system prompt, then a place name within a few seconds. Try deny, and "deny and do not ask again" (it should offer to open settings), and typing a place with no permission.

**Reminders**
- Turn on "Remind me when it is due" on a recurring rule. On Android 13 and newer the system asks for permission first. The phone's notification settings for the app should list "Bill reminders".
- To see one fire without waiting: make a rule that is due tomorrow, then set the phone's clock (Settings, Date and time, turn off automatic) to 08:58 tomorrow and wait two minutes. The notification should read "<title> is due today" and tapping it opens the app. Set the clock back afterwards.
- Turn the switch off: no notification should come.

**Files**
- Share a PDF from Insights and a CSV from Settings, to an app of your choice. Back up the data, then restore from that file on the same phone: the typed word, the counts and the result on Home.
- The app lock: turn it on with a phone PIN or fingerprint, leave the app for more than a minute, come back.

**Everyday use**
- Record, edit, delete and undo a few transactions with tags, a wallet and a place. History filters: dates, amount range, a tag. The spending calendar on a month with several days of spending.
- A transfer between two wallets, with an earlier date, then edit it.
- TalkBack: go through Home, the add sheet, History with the filters panel, the calendar and the Tags screen.
- A tablet or an unfolded device, if there is one: History shows the list and the detail side by side from a width of 840 dp. The app is locked to portrait, so a phone never shows it.

**Speed and size** (nothing was measured so far)
- Cold start: time from tapping the icon to Home, or `adb shell am start -W -n com.veingh0st.duitku/.MainActivity` for a number. A dev build is slower than a release build, so treat it as an upper bound.
- Scrolling History with many rows: the dev screen at `/dev-data` can make synthetic data in a separate database. Developer options, Profile GPU rendering, shows frame bars.
- APK size is on the build page.

## What to send back

- For a failure: what you did, what you expected, what happened, and a screenshot with private numbers hidden.
- For a crash: `adb logcat -d` right after it, filtered with `findstr /i "voidspend ReceiptScan AndroidRuntime"`, and the phone model and Android version.
- For a failed build: the last forty lines of the build log.

## Decisions that still wait for the owner

- Version 2.0.0 in `app.json` (it is 1.0.2 now), and the release build and store upload.
- Whether Android's automatic backup to a Google account stays on.
- A white-on-transparent small icon for notifications, so a reminder does not show Android's default icon.
- What to do about the 13 vulnerabilities `npm install` reported (one critical). They were not looked into: run `npm audit`.
- Whether receipt photos belong in a backup. A single JSON file with photos inside would be too large.
