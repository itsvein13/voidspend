# VOIDSPEND v2, milestone M8: responsive layout, accessibility, backup, app lock, recently deleted

Branch `v2-redesign`, 18 November 2026. Nothing is committed. A wide window gets a rail, large system text no longer breaks the summary rows, deleted transactions can be restored for 30 days, the whole app can be backed up and restored, and an optional app lock uses the phone's own screen lock. Choosing a backup file on a device and TalkBack were **not run**.

## Status

| Item | Result |
|---|---|
| Wide layout: from 840 dp the dock becomes a rail down the left edge | Done, verified on the emulator at 1067 dp wide |
| Medium layout (600 to 839 dp) | The content column stops at 640 dp and the dock at 480 dp (from M1 and M3). Checked once at 800 dp |
| Large system text: the three amounts in the Home hero and the Insights summary stack as rows from font scale 1.15 | Done, found and fixed on the emulator at font scale 1.3 |
| Recently deleted: list, restore, delete forever with a confirm, 30 day purge at start, receipt photos removed with the last transaction that used them | Done, 7 repository tests, verified on the emulator |
| Backup: one JSON file with every table, shared through the share sheet | Done, 13 tests on real SQL. The share sheet was not opened on the emulator |
| Restore: pick a file, see what is in it, type a word, replace everything in one transaction | Done and tested (a bad file, a newer file, a hostile column name and a broken row all leave the old data in place). The file picker could not be completed on the emulator |
| App lock: switch in settings (verifies first), lock at start and after one minute in the background, cover hides the app from screen readers | Done, 5 tests, verified on the emulator with a PIN |
| README rewritten for v2, with what is not verified | Done |
| Web bundle (`expo export --platform web`) | Builds |
| Typecheck, lint (0 problems), Jest (33 suites, 466 tests), `expo-doctor` (21 of 21) | All green |

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| A rail instead of a floating dock from 840 dp | A dock floating in the middle of a wide screen wastes the screen and the thumb reach it was built for. A rail sits in the layout, so no screen reserves room at the bottom |
| No master and detail pane on wide screens | Lists stay one readable column. A detail pane means rebuilding History and Goals as split views, and nothing in the owner's brief needs it yet |
| The stacking threshold is system font scale 1.15 | At 1.3 the three amounts collided and one was cut off. At 1.15 they still fit, so only people who need big text get the taller layout |
| Restore replaces everything, and needs a typed word | It is the one action that can destroy current data, like "Delete all data". The word and the one-transaction rollback keep it from happening by accident or half way |
| The backup leaves out receipt photos | They are large and live in the app folder. A restored receipt keeps its lines and total but has no photo, and the restore screen says so |
| Column names in a backup are checked against the real table before any SQL is built | A file from outside is data. A crafted column name could otherwise change the SQL |
| The lock uses the phone's screen lock and stores nothing | The app holds no PIN or secret of its own to leak, and works with fingerprint, PIN and pattern alike |
| Turning the lock on asks to verify first | A lock that cannot be opened would lock the person out of their own data |
| One minute of grace before relocking | A camera, a file picker or a share sheet takes the app to the background for a moment, and should not lock it mid-task |
| The app stays mounted under the lock cover | An unfinished entry is still there after unlocking |
| The lock setting is per device and is not in a backup | Restoring on another phone must not lock someone out with a setting that phone cannot satisfy |

## Verification

Emulator (Android 11, Expo Go):
- At 1067 dp wide the dock became a rail with the add button on top and the four places below, Home marked, and the content kept its 640 dp column in the middle.
- At font scale 1.3 the Home hero and the Insights summary showed "+Rp 5.000.000-Rp 15.500Rp 25.00" run together and cut off. After the fix each amount sits in its own row. History rows, the dock labels and the buttons held up.
- Recently deleted showed a deleted expense with "30 days left". "Delete forever" asked "Delete forever? This cannot be undone." and, once confirmed, showed "Deleted for good" and the empty state.
- App lock: with a test PIN on the phone, turning the switch on opened the system prompt "Unlock VOIDSPEND". A cold start showed the system prompt, and cancelling it left "VOIDSPEND is locked", "Verification failed. Try again." and an Unlock button. The PIN opened the app. The switch and the PIN were then turned off.
- Restore: the button opened Android's file picker and listed a pushed test file. Selecting it did not complete: Expo Go was restarted by the 2 GB emulator while the picker was open, so the result was lost. That path is unverified.

Tests: backup (create, parse, restore and every refusal), recently deleted (list, restore, count of days, expiry, erase with receipts), lock rule and lock screen, preferences with the new `appLock` field.

Not run: TalkBack (the emulator image has no Google TalkBack), the backup file share, the file picker result, the lock after a minute in the background.

### Defects found and fixed in this milestone

| Defect | Fix |
|---|---|
| At font scale 1.3 the three summary amounts ran into each other and were clipped, on Home and in Insights | They stack as rows from scale 1.15 (`largeText` from `useBreakpoint`) |
| `StyleSheet.absoluteFillObject` no longer exists in React Native 0.86 (found by the typecheck) | The cover uses explicit absolute positions |

## Known limitations and open items

- Check on a phone: choosing a backup file, restoring it, the lock after a minute away, TalkBack on Home, the add sheet and Settings.
- TalkBack was not run. What exists for it: a label on every control, roles on the rail and dock, a polite live region for the lock error, and the cover hides the app below it.
- The recently deleted screen has no "delete all" and no search. With 30 days of history that was not needed yet.
- A restored database keeps the setting for the v1 import as it was in the backup. A backup made before the import finished could trigger the import again, which is safe because every imported row has a unique reference.
- Android's own automatic backup to a Google account is still on by default. Turning it off or limiting it is a release decision for the owner (`android.allowBackup`).
- There is no wide layout with two panes, and Insights and History are one centered column on a tablet.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src`, `docs` or the README.
- R-03 PASS for what was run: compact, a 800 dp window, a 1067 dp window and font scale 1.3. A reflow into a rail on wide windows, and stacked rows with large text.
- R-17, R-18, R-36, R-38 PASS: the README claims only what the code does and has a section naming what is not verified.
- R-23 PASS: no new logo, avatar or illustration.
- R-25 PASS: the new screens use the existing token pairs, which are proven in `tokens.test.ts`.
- R-26 PASS: every new control acts. The lock, the backup and the restore are real.
- R-27 PASS: recently deleted has loading, empty and list states, restore has idle, refused, confirm and busy states, the lock has locked and failed states.
- R-32 PASS in code (native elements and roles). Not run with a keyboard or TalkBack.
- R-35 PASS for what was run (listed above), and the unrun paths are named.
- R-39 PASS: every new control has an accessible name, the delete confirmation and the restore warning are in words, and the new motion respects reduced motion.

Result: PASS, with TalkBack, the file picker result and the real-phone checks recorded as unverified.

## Next

M9 (wallets and transfers) follows the plan.
