# VOIDSPEND v2, milestone M10: the features that were left out

Branch `v2-redesign`, 19 November 2026. Nothing is committed. After M9 and M9b the owner asked for the features still on the "not built" list to be built before a release. This note covers what was built, what was run on the emulator, and what was not. One dependency was added (`expo-notifications`) and no migration was needed: the tags tables and the `remind` column were in the first migration.

## Status

| Item | Result |
|---|---|
| **Tags:** put up to 8 on any transaction, reuse earlier ones, rename or delete a tag, see them in History and the detail screen, search by tag | Done. Verified on the emulator |
| **History filters:** date presets and a date range, amount range, tag, "only with a receipt", "only with a place", place name, one chip for each filter that is on, "Clear all filters" | Done. Dates, amount range and tag verified on the emulator, the rest by tests |
| **Spending calendar** in Insights for a month: a grid of days shaded by spending, a readout of the day picked, and a button to open that day in History | Done. Verified on the emulator |
| **Bill reminders:** a switch on each recurring rule, a local notification at 9:00 on the day it is due | Done. Scheduling verified on the emulator (6 alarms for the next 6 occurrences, none after turning it off). The notification itself was not seen |
| **Transfer date and time**, in creating and in editing | Done. A transfer made with "Yesterday" appears under yesterday in History |
| **A wallet on the salary setup** | Done, tested. The screen was not run |
| **Goal by wallet:** a "By wallet" list on a goal that has moved money through more than one wallet | Done, tested. The screen was not run |
| **Receipt photo zoom:** pinch, drag, double tap, plus Zoom in and Zoom out buttons | Done. Buttons and drag verified on the emulator. Pinch and double tap were not run |
| **Two-pane History** from 840 dp: the list on the left, the detail of the picked transaction on the right | Done. Verified on the emulator at a 1440 dp wide window |
| Typecheck, lint (0 problems), Jest (43 suites, 566 tests, up from 495), `expo-doctor` (21 of 21), web bundle builds | All green |

## How it behaves

1. **Tags.** The add sheet has a Tags field: type a name and press Add or the keyboard's Done, or tap one of the tags used before. A tag is stored once and found by name without regard to case, so "Liburan" and "liburan" are one tag. A name loses a leading hash and extra spaces, and is at most 24 characters. The transaction and its tags are saved in one database transaction, so a refused tag leaves nothing half saved, and Undo puts the old tags back. Settings, then Tags, lists every tag with how many transactions carry it, and renames, deletes (after a second tap, with the count in words) or opens its transactions. A deleted transaction does not count in that number, and its tags come back with it.
2. **History filters.** Under the type and wallet chips there is a Filters chip. It opens a panel with date presets (This month, Last month, Last 30 days, This year) and, on Android, From and To pickers; a minimum and a maximum amount (a reversed pair is swapped); the tags in use; two switches (only with a receipt, only with a place); and a place name. Each filter that is on also shows as a chip under the Filters chip, and a tap on it lifts that filter. The search box now matches tags and place names too. Tags and dates live in the route, so the Tags screen and the calendar can open History already filtered.
3. **Spending calendar.** Insights, for a month with spending, gets "Spending by day": seven columns from Monday, each day shaded in five steps from faint to strong against the busiest day (on a square-root scale, so one large purchase does not make every other day the faintest step). Tapping a day shows its amount in words under the grid, with the busiest day for comparison, and a button opens that day in History. With a wallet chosen in Insights it shows that wallet only. A year has no calendar.
4. **Reminders.** On the Recurring screen each rule has "Remind me when it is due". Turning it on asks the phone for permission when the phone needs it (Android 13 and newer). The app then keeps the phone's scheduled notifications equal to the next 6 occurrences of every rule with a reminder, at 9:00 in the phone's zone, and replaces them whenever a rule changes. A paused rule, an ended rule and a due date already past have none. A rule that records itself says so in the text. Nothing is scheduled, and the notification system is not even loaded, until a reminder has been asked for once.
5. **A transfer's moment.** The transfer screen has the same "When" chips as the add sheet: Now, Yesterday, or a picked day and time. Editing a transfer keeps its exact moment unless the person picks another.
6. **Salary and goals.** The salary setup shows the wallet chips when there is more than one wallet, and the salary (the rule and this month's income) goes there. A goal that has moved money through more than one wallet lists what each wallet put in, deposits minus withdrawals.
7. **Photo zoom.** The full-screen receipt photo zooms about the fingers, can be dragged when zoomed so that no edge leaves a gap, zooms in and out on a double tap, and has two buttons for people who cannot pinch. Reduced motion makes the zoom instant.
8. **Wide windows.** From 840 dp the History screen shows the list and, beside it, the transaction that was picked, with the picked row highlighted. Deleting from the pane empties it and offers Undo. Edit and Duplicate open the sheet on top, so the list stays. On a phone nothing changed: a tap opens the detail as its own screen.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| A tag is one row found by name, not text on the transaction | Renaming or deleting a tag then changes every transaction at once, and a typo is fixed in one place |
| Tags are kept when a transaction is deleted and restored | Restoring a deleted transaction should bring back the whole of it |
| Filters beyond type and wallet sit in a closed panel, with a chip for each one that is on | The common case stays as light as before, and the list never narrows without saying so |
| The calendar's shade is never the only way to read an amount | Every day can be selected and its amount is written under the grid, and each day's accessible name carries the amount. Shades are checked against 4.5:1 for the day number in both themes |
| Spending shades are a neutral ramp, not lime or red | Red and lime keep their meanings in this app |
| A reminder at 9:00, fixed | One time keeps the switch a switch. A choice of time can come later if it is asked for |
| The next 6 occurrences are scheduled, not only the next | If the app is not opened for a while, the next due date still reminds |
| Notification channel creation may fail without stopping the reminders | Expo Go cannot create one, and some phones may refuse. The reminders then use the default channel |
| The two-pane layout reuses the detail screen as a component | One place to change what a transaction shows |
| Zoom buttons next to the gestures | A gesture alone excludes people who cannot pinch |

## Verification

Emulator (Android 11, Expo Go, a fresh database):
- **Tags.** A new expense got two tags, one added with the Add tag button and one with the keyboard. The History row read "Food, 07:11, #kantor #liburan" and the detail screen listed them. Settings, then Tags, listed both with "1 transaction". Renaming one to an existing name said "A tag with that name already exists.", renaming to a new name worked and showed in History at once, and "Show transactions" opened History on that tag.
- **Filters.** The panel opened with the presets, the two date pickers, the amount fields side by side and the tags in use. Picking a tag showed "Filters (1)" and a chip. Adding a minimum of 100.000 showed "Filters (2)" and the chips "Rp 100.000 or more" and "#liburan", and the list said "Nothing matches". "Clear all filters" put everything back.
- **Calendar.** With spending on the 18th (260.000) and the 19th (150.000) of November, the grid showed both days shaded differently, the 19th marked as today, and the readout "Wed, 18 November 2026: spent Rp 260.000". Tapping the 19th changed the readout and added "Busiest day: Wed, 18 November 2026, Rp 260.000". "See that day's transactions" opened History with the chip "19 Nov".
- **Reminders.** The switch on the salary rule produced 6 alarms from the system's alarm list, the first at 25 December 09:00 (the next due date), one a month after. Turning it off left none. Turning it on again gave 6, not 12. Expo Go logged that it cannot create the channel, and the reminders were still scheduled.
- **Transfer date.** A transfer of 10.000 recorded with "Yesterday" appeared under the "Yesterday" heading in History.
- **Photo zoom.** From the dev sample photo, the full-screen view showed Close photo, Zoom out and Zoom in. Two presses of Zoom in enlarged the photo, and a drag moved it.
- **Wide window.** At 1080 by 1900 pixels and 120 dpi (1440 dp wide) History showed the rail, the list and "Pick a transaction to see its details." Tapping a row filled the pane and highlighted the row. Delete emptied the pane and the row left the list. At the phone's own size a tap still opened the detail as a screen.

Tests added (495 to 566): tag names and limits, tags on transactions (case, replace, atomic save, more than one query's worth), rename and delete, tags in the form, in the CSV (a Tags column only when asked, a guard against a tag that starts like a formula) and in reset; every History filter in the repository (amount, tag, receipt, place, search by tag and place, a wildcard typed in a place is plain text); the filter module (ranges, presets across a year end and a leap year); the calendar grid and its steps; the colors of the calendar in both themes (4.5:1 on every step); the daily totals; the reminder plan (dates, zone, paused, ended, behind, weekly and yearly, ids that make a second run replace the first); the zoom limits; a goal by wallet; a salary into a wallet; the moment of a transfer.

Not run: a reminder actually appearing (the alarm was set, its time was not reached); the permission prompt of Android 13 and newer (the image is Android 11); channel creation (Expo Go cannot, a production build was not made); a two-finger pinch and a double tap on the photo; the From and To date pickers and the switches in the filter panel; the goal "By wallet" list and the wallet chips on the salary setup; Edit and Duplicate from the detail pane; a tag on a transfer or a saving; CSV export with tags on a device; TalkBack on any new screen; a window wider than three wallets or with very long tag names.

## Known limitations and open items

- **Notification icon.** The plugin sets the notification color. There is no monochrome small icon in the assets, so a production build may show Android's default icon on a reminder. A white-on-transparent icon is needed before a release.
- **Reminder time.** It is 9:00 and cannot be changed.
- **The notification module in Expo Go** warns that it is not fully supported. A development or production build does not.
- **Receipt photos are still not in a backup.** A JSON file with photos inside would be many megabytes, so it needs another format. It is a decision for the owner.
- **The document scanner (crop and perspective fix)** is still not built: it is a native module and there is no Android toolchain here to compile one.
- **The Skia hero (M7b)** is still not built, for the reason in `docs/v2-m7-motion.md`.
- A tag is global to the app, not to a wallet.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src`, `docs` or the README.
- R-04 PASS: the new icons (options, calendar, add, remove) are the ones that name the control.
- R-17, R-18, R-36, R-38 PASS: every number above comes from the run on the emulator or from a test, and what was not run is named.
- R-23 PASS: no new logo, avatar or illustration.
- R-25 PASS: the day numbers of the calendar are tested at 4.5:1 on every shade in both themes.
- R-26 PASS: every new control acts. The panel, the chips, the switches, the zoom buttons and the pane are hidden when they have nothing to do (no tags in use, one wallet, a phone).
- R-27 PASS: the Tags screen has loading and empty states, History has its "Nothing matches" state with a way to clear, the calendar is left out of an empty month, and errors are in words.
- R-32 and R-39 PASS: the photo zoom has buttons next to the gestures, the calendar days are buttons with the amount in their name, and the chips and switches carry their labels.
- R-35 PASS for what was run (listed above), and the paths not run are named.

Result: PASS.

## Before a release

What the owner needs to know, in one place:

- **Never run on a device:** the ML Kit text reader (written, never compiled), a real location reading, the camera, the PDF share, the backup share, the file picker for a restore, and now a reminder appearing and the Android 13 permission prompt.
- **Not measured:** frame rate, cold start and APK size.
- **Parser accuracy** is based on made-up receipts. Real receipts are needed.
- **Android automatic backup** to a Google account is still on by default. Decide before release.
- **App version** in `app.json` is still 1.0.2. The plan calls the release 2.0.0.
- **`npm install` reported 13 vulnerabilities** (1 critical) in the dependency tree. They were not looked into here. Run `npm audit` and decide.
- **Nothing is committed**, and no build, upload or account change was made.
