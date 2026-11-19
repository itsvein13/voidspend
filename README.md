# VOIDSPEND

_track the drain._

A personal finance tracker for people who want a fast way to see where their salary goes each month, without an account, a bank connection or a server holding their financial data. Everything stays on the phone.

![Platform](https://img.shields.io/badge/platform-Android-3DDC84)
![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020)
![Language](https://img.shields.io/badge/language-TypeScript-3178C6)

---

## About

VOIDSPEND tracks one monthly salary: it comes in, spending and saving go out, and the home screen always shows how much is left. The "void ring" on Home is that number drawn as light around a void. It drains as you spend and changes color as the money runs low.

The brand is black and lime with a mascot, and the app is in Indonesian and English (it follows the phone, and can be switched in settings).

## What it does

- **Void ring home screen.** What is left this month, how much is safe to spend each day until payday, income, spent and saved, and the latest transactions.
- **One add sheet.** Expenses and income on a calculator keypad, with category, merchant, note, payment method, a date and time that can be set or left unknown, and an optional place.
- **Accurate time.** Every transaction stores the real moment, the phone's time zone and the local date, so a late-night coffee stays on its day after a trip.
- **History.** Grouped by day with the time, search (title, merchant, note, place and tag), swipe to edit or delete, and Undo. Filters for type, wallet, category, dates, amount range, tag, receipt and place. On a wide window the picked transaction opens beside the list.
- **Tags.** Up to eight short labels on any transaction, reused from earlier ones, renamed or deleted in one place.
- **Recently deleted.** Deleted transactions are kept for 30 days and can be restored or removed for good.
- **Wallets and transfers.** Cash, bank and e-wallet accounts with a starting balance (below zero for a credit card or a loan), what each one holds, and a transfer that moves money between them without touching income, spending or savings. A transfer can be edited, a recurring item can record into any wallet, and History and Insights can be narrowed to one wallet. The wallet pickers only appear once there is a second wallet.
- **Goals.** Savings goals with deposits, withdrawals, target and progress. A withdrawal cannot take out more than the goal holds.
- **Budgets.** A limit per category from a month on, with a warning when a save crosses it.
- **Recurring items.** Salary and bills that are offered on their due day and recorded with one tap, into the wallet of your choice. Each can send a local reminder at 9:00 on its due day.
- **Insights.** A month or a year, for all wallets or one: income, spent, saved, savings rate, change against the last period, a category donut that opens History, month bars, a spending calendar and top merchants.
- **Receipt scanner.** Choose a photo, review every field and line, and save. Duplicates are flagged. See the limits below.
- **Location, only on request.** Type a place, or read the device position once with a tap. Never automatic, never in the background, stored rounded to about 110 meters, and left out of exports unless ticked.
- **Export and backup.** CSV and a PDF summary, and a JSON backup of everything that can be restored on any phone.
- **App lock.** Optional: the phone's own fingerprint, PIN or pattern is asked when the app opens and after it has been away for a minute.
- **Themes and accessibility.** Dark, light or follow the system. Reduced motion, haptics switch, labels on every control, and layouts that hold up at large system text. On a wide window the dock becomes a rail.
- **Offline.** No account, no analytics, no network calls of its own.

## What is not verified yet

These parts are written and tested in code, but have not run on a real phone:

- **The receipt text reader.** It is a small local Android module around Google ML Kit (`modules/receipt-scan`). It has never been compiled. Without a development build, the scanner shows the photo and lets you fill the fields yourself. The receipt parser is tested on made-up receipts only.
- **A real location reading.** The emulator has no Google Play services, so only the typed place and the "not available" state were seen.
- **Choosing a file to restore a backup**, **sharing the PDF** and **the camera** were not exercised on a device.
- **Reminders.** The alarms were seen scheduled on the emulator, but a reminder appearing, the Android 13 permission prompt and the notification channel (Expo Go cannot create one) were not. There is no small notification icon yet.
- Frame rate, cold start time and APK size were not measured.

Each milestone's own notes in `docs/` list what was run and what was not.

## Tech stack

- [React Native](https://reactnative.dev/) 0.86 and [Expo](https://expo.dev/) SDK 57, React 19 with the React Compiler
- [Expo Router](https://docs.expo.dev/router/introduction/) for navigation
- `expo-sqlite` for storage, with SQL migrations and soft deletes. Money is whole rupiah.
- Reanimated 4 and `react-native-svg` for motion and charts, with no chart library
- `expo-location`, `expo-image-picker`, `expo-document-picker`, `expo-local-authentication`, `expo-notifications` (local reminders only), `expo-print`, `expo-sharing`, `expo-haptics`
- Space Grotesk and Plus Jakarta Sans
- Jest with Testing Library. Repository tests run real SQL on Node's built-in SQLite.

## Getting started

```bash
git clone https://github.com/itsvein13/voidspend.git
cd voidspend
npm install
npx expo start --go
```

Open the QR code in Expo Go on an Android phone, or press `a` with an emulator running. Everything works in Expo Go except the on-device receipt text reader, which needs a development build (`npx expo run:android` with the Android SDK, or an EAS development build). Expo Go also warns that the notifications module is only partly supported there, and cannot create the reminder channel; the reminders are still scheduled. To try the parts Expo Go cannot show on a real phone, see `docs/v2-phone-test.md`.

Checks:

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## Your data

- Everything is in one SQLite database in the app's private storage.
- The v1 data (AsyncStorage) is imported once on the first launch of v2, with a backup file written first and the totals checked against the old numbers.
- "Back up data" writes one JSON file with every transaction, goal, budget and setting. Receipt photos are not included. "Restore from a backup" replaces everything on the phone with that file, after a typed confirmation, and changes nothing if the file is damaged.
- Android may copy app data to your Google account with its own automatic backup. Check that setting if that matters to you.

## Design notes

The identity grows from the app icon: a V falling into a ring. Lime is for the main action and for money left, blue for savings, red only for problems, amber for a limit that is close. Spending is shown in neutral text with a minus sign, so red keeps its meaning. Docs for each milestone, with the decisions and their reasons, are in `docs/`.

## Author

Built by **Rizki**, [@veingh0st](https://instagram.com/veingh0st).

---

_VOIDSPEND is a personal project built to explore product design and mobile development end to end._
