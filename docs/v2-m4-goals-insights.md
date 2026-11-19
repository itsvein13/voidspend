# VOIDSPEND v2, milestone M4: goals, budgets, insights, export

Branch `v2-redesign`, 18 November 2026. Nothing is committed. M5 (receipt scanner) has not started and needs the owner's go-ahead.

## Status

| Item | Result |
|---|---|
| Goals tab: total saved, goal cards with a progress ring, target date and "needs Rp X per month" | Done |
| Goal detail (ring, deposit, withdraw, timeline, edit, archive with Undo) and goal form | Done |
| Add sheet with Save and Take out (withdraw) types, goal chips, editing of saving rows | Done |
| A withdrawal can never take out more than the goal holds | Done |
| Budgets screen and edit sheet (limit, alert level, applies from this month), alert when a save crosses a line | Done |
| Insights tab for a month or a year: left, savings rate, change against the last period, donut by category, bars, top merchants | Done |
| Tapping a slice or a row opens History filtered by that category and period | Done |
| CSV export (period, or everything from Settings) | Done, share sheet verified on the emulator |
| PDF export | Built, not verified on the emulator (see limitations) |
| Settings: Budgets, Categories (add and hide), Recurring (amount, automatic, pause), Delete all data with a typed word | Done |
| Pending salary card has Edit, which opens Recurring | Done |
| Dock now has Home, History, Add, Goals, Insights | Done |
| Typecheck, lint (0 problems), Jest (25 suites, 370 tests), `expo-doctor` (21 of 21), web bundle (200) | All green |

## Where the code is

- `src/features/goals`, `insights`, `budgets`, `export`, `settings` hold the screens and their rules. Routes are one-line files in `src/app`.
- `src/design/charts`: `ProgressRing`, `Donut`, `Bars` (react-native-svg and plain views, no chart library).
- `src/db/repo/transactions.ts` gained `rangeTotals`, `categoryTotalsRange`, `merchantTotals` and `monthlyBars`. `src/lib/finance.ts` gained `budgetCrossing`.
- `src/i18n`: goals, moves, insights, budgets, manage, recurring, more and reset groups in both languages.
- New packages: `expo-sharing` and `expo-print`.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| Donut color follows the category, and every category without its own color (Other and the ones people made) folds into one gray slice | No two slices look alike, and color never depends on rank |
| The list under the donut is tappable and carries the same numbers | The ring is a picture, the list is what a screen reader and a thumb use |
| Spending bars are neutral gray, income is lime | Red is for problems only |
| An alert fires once per line crossed (almost used, then over) | An expense that was already over does not nag again |
| A budget row applies from its month on | Changing a limit never rewrites last month |
| A withdrawal check runs before the write and leaves the edited row out of the count | Editing a withdrawal cannot trip over itself |
| CSV text cells starting with = + - or @ get a leading apostrophe, with a byte order mark and CRLF lines | A spreadsheet must not run a note as a formula, and Excel must read the UTF-8 |
| The PDF page is white with black text | It is made for paper |
| Delete all data needs the word typed (HAPUS or DELETE), keeps theme and language, and marks the v1 import and profile carry-over as done | A stray tap cannot wipe data, and the old v1 name does not come back |
| Spending-by-merchant groups by the typed merchant ignoring case | "Warung Bu Tini" and "warung bu tini" are one place |

## Verification

Emulator (Android 11, Expo Go, Metro 8082):
- Goals: empty state, new goal "Liburan" with target Rp 2.000.000 (shows "Rp 0 of Rp 2.000.000"), deposit Rp 500.000 (ring 25 percent, timeline row), a withdrawal of Rp 600.000 was refused with "This goal does not hold that much.", Rp 100.000 was accepted (Rp 400.000, 20 percent).
- Budgets: Food limit Rp 300.000 showed "Rp 250.000 of Rp 300.000, Almost used"; a Rp 60.000 Food expense then showed "Food budget is over" with Undo, and Home listed "Budgets this month".
- Insights: donut for Food, income and spending bars for six months, legend, the Budgets row. CSV opened the Android share sheet (the emulator has no app that receives files, so it said so).
- Recurring showed the Rp 6.000.000 salary rule with amount, automatic and paused controls. Categories added "Skincare". Delete all data kept the button off until DELETE was typed, then returned to the welcome screen.

Tests: 17 new in `m4.test.ts` (budget crossing, insights for a month, a year and an empty period, donut folding, CSV escaping and formula guard, report escaping, goal withdrawal limit, monthly need, saving form rules, reset, recurring update) and 3 new in `ui.test.tsx` (deposit into a picked goal, over-withdrawal message, budget alert after saving).

### Defects found and fixed in this milestone

| Defect | Fix |
|---|---|
| The merchant query lost its quotes in a shell edit and failed with "no such column: expense" | Quoted, and covered by a test |
| The stats row overflowed the card because of a long "nothing to compare" line | The line shows once under the row, and only when all three have no baseline |
| "Withdraw" wrapped letter by letter in the four-way type control | English label is now "Take out" |
| After a reset, the v1 name and welcome flag came back from old storage | Carry-over runs once and is marked done by reset |
| The tap target "Save" matched both the type option and the footer button in my emulator script | Script issue only, the app was right |

## Known limitations and deviations

- **PDF share is not verified.** `Print.printToFileAsync` produced a file on this emulator that neither `expo-sharing` nor a copy could read ("isn't readable"), which looks like the Android 11 emulator image. The standard documented flow is kept. Check it on a real phone before release.
- Tags are not built: the tables exist, there is no tag field in the sheet yet. The daily spending calendar and the "recently deleted" screen are not built either.
- No inline editing of a recurring item's category or day, only amount, automatic and pause.
- The donut, bars and goal ring were checked in dark only. In light the green and pink category colors are below 3:1, so slices always have the labeled list next to them (noted in M1).
- Backup file and restore stay in M8.
- TalkBack, large font and tablet widths on the new screens are still unchecked (M8).
- Sheets are still full-screen modals (M3).

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src` or `docs`. R-03 PASS on the emulator, nothing clipped after the stats fix.
- R-17, R-18, R-36, R-38 PASS: no statistics or claims. Numbers on screen come from the person's own data.
- R-24, R-26 PASS: every new row, chip and button acts. The date chip is disabled where the dialog does not exist.
- R-27 PASS: loading skeletons, empty states (goals, insights, history), an error snackbar for failed exports.
- R-25, R-34 PASS: only existing tokens and tones; the ring, donut and bars read their colors from the theme.
- R-35 PASS: run on the emulator, click-through above.
- R-39 PASS: the ring has progress semantics, the donut has one summary sentence, each bar pair has a full sentence, new buttons carry names, the withdraw and over-budget states are words and not only color.
- R-01, R-10, R-12, R-13 PASS: no new glow or glass; the Insights summary reuses the hero glass, the dock and snackbar remain the shadows.
- R-05 PASS: Goals, Insights and the forms each have their own composition. R-15 PASS: buttons say what they do ("Save goal", "Download CSV").

Result: PASS, with the PDF share and the unchecked accessibility passes recorded, not hidden.

## Next

M5 starts only when the owner says so: the receipt scanner (capture, on-device text recognition, the parser, the mandatory review step, duplicates). It needs a native module, so the Expo Go workflow ends there and a development build is decided.
