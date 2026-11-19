# VOIDSPEND v2, milestone M3: core experience

Branch `v2-redesign`, 18 November 2026. Nothing is committed. M4 (goals, budgets UI, insights, export) has not started and needs the owner's go-ahead.

## Status

| Item | Result |
|---|---|
| New shell: providers, splash, gate, floating dock, tabs | Done |
| One-time v1 import with a report screen, wired into the first launch | Done, verified on the emulator with the real v1 data on it |
| Welcome and setup (name, language, salary, payday) | Done, verified on web with a fresh storage |
| Home: Void ring hero, safe amount per day, pending salary, budgets pulse, recent rows, month switch | Done |
| Add and edit sheet: keypad, categories (recent first), title, merchant, time, payment, note | Done |
| Detail sheet: edit, duplicate, delete with Undo | Done |
| History: search, type filter, sticky day headers with day totals, swipe to edit or delete, Undo, paging | Done |
| Settings: name, theme, language, motion, haptics, data report, salary setup, support link | Done |
| Old v1 screens, contexts and constants removed | Done |
| Typecheck, lint (0 problems), Jest (24 suites, 353 tests), `expo-doctor` (21 of 21) | All green |

## What the person sees

- First launch: a 2.2 second splash with the credit, later launches 0.8 seconds, tap to skip, no fade under reduced motion. Then the import report (only when v1 data exists), then the welcome (only if the person never saw it; v1 users are carried over), then Home.
- Home has one focal point, the ring. Below it: income, spent and saved, "safe to spend per day until payday" when a salary rule exists, two actions, a pending card when a salary is due (Record, Skip), the closest budgets when any exist, and the latest five rows.
- The dock floats with Home and History on either side of the add button. The ring around the add button is the void ring motif.
- Recording an expense takes an amount and a category. A blank title becomes the category name. Time defaults to now, can be yesterday, a picked date (Android) or "time unknown" (stored as a date at noon). An edit keeps the zone the transaction was recorded in.
- Save, edit and delete all show a snackbar with Undo above the dock.

## Where the code is

- `src/app`: routes only. `(tabs)` has Home and History, plus `add`, `transaction/[id]`, `salary`, `settings`, and the dev-only `gallery` and `dev-data`.
- `src/features/shell` (splash, gate, dock, import flow, welcome), `home`, `history`, `transactions` (form rules, add sheet, rows, grouping), `settings`, `profile` (name, onboarding flag, salary setup), `categories`.
- `src/lib/clock.ts`, `dateLabels.ts`; `src/i18n` gained 10 groups in both languages and `errors.ts`.
- Form rules, grouping, salary setup and home data are pure and tested without React: `features.test.ts` (19 tests). `ui.test.tsx` (10 tests) renders the add sheet against a real SQLite.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| Gate before the router, not redirects | The first screen depends on the database, so a deep link cannot skip the import or the welcome. Dev routes bypass it |
| Blank title becomes the category name | The fastest entry is an amount and a category |
| Month totals use the stored local date, Home never shows a future month | Same numbers as v1, and no empty future months |
| Salary setup: "already in this month" records it now and starts the rule next month | A new person sees a real ring on the first day instead of an empty one |
| Swipe is a shortcut, the same actions live in the detail sheet | Swipe cannot be used with a screen reader |
| Snackbars are lifted above the dock (`snackbarOffset`) | A message must not sit on the control it came from |
| Image assets are required with relative paths | Metro does not apply the `@/` alias to `require()` of assets |

## Verification

Emulator (Android 11, Expo Go, Metro 8082), using the real v1 data on it (a username and one salary):
- First launch showed "Your old data has moved" with the right counts and the backup file path, then Home with "Hello, Rizky" (name carried over from v1) and Rp 5.000.000 left.
- Record expense: 2, 5, 000 on the keypad, Food, Save. Home showed Rp 4.975.000, spent Rp 25.000, snackbar with Undo. History grouped it under Today with "Spent Rp 25.000" and the 17:56 time.
- Detail opened with the right fields, Delete showed the snackbar and Undo brought the row back. Edit prefilled Rp 25.000, one more zero saved Rp 250.000 and History updated.
- Swipe left on a row deleted it with Undo, swipe right opened Edit. Search for "zzz" showed "Nothing matches".
- Settings showed the name, theme, language, motion, haptics, the import date and backup path. The salary screen created a salary rule, and Home then showed "Safe to spend Rp 1.535.714 a day until 24 Nov" (the rule's payday is the 25th).
- Indonesian and the light theme both rendered Home correctly (hero, legend, dock). Settings were put back afterwards.

Web (a fresh origin, so empty storage): the welcome, then setup with name and salary Rp 5.000.000, then Home with income Rp 5.000.000 and "Safe to spend Rp 714.285 a day until 24 Nov". Console clean.

### Defects found and fixed in this milestone

| Defect | Fix |
|---|---|
| Native form sheets never opened under Expo Go on Android 11 (navigation looked dead) | Sheets are full-screen modals for now |
| Swipe direction was reversed: a left swipe opened Edit | The direction names the way the row moved. Fixed and retested |
| `require("@/assets/...")` failed to bundle | Relative paths |
| The hero legend wrapped a long income across two lines | The items size to their content again |
| Subtitles said "Food, Food" when the title was the category | The category is left out when it is the title |

## Known limitations and deviations from the plan

- Sheets are full-screen modals, not native form sheets. Revisit with a development build (M5 decides the build route).
- No blur on the dock yet. It is designed smoke-first, and `expo-blur` waits for a device or an Android 12 image to judge it on.
- The dock has Home, History and Add. Goals and Insights arrive in M4, so there is no dead navigation.
- The add sheet has Expense and Income only. Saving types need the goals screens (M4), so saving rows can be deleted but not edited yet.
- No "Scan receipt" action (M5), no inline duplicate warning (M5), no "Edit" on the pending salary card (needs the recurring screens, M4). Record and Skip work.
- Swiping the hero to change month was replaced by chevrons.
- Picking a date uses the Android dialogs only. Web and iOS offer Now and Yesterday.
- v1 Report, Profile and the old budget and saving screens are gone, so budgets can be seen on Home but not set, and there is no report or export until M4.
- Not verified: TalkBack, large font and tablet widths on the new screens (M8), the onboarding on a phone (it needs cleared app data, done on web), splash timing, the light theme outside Home, keyboard Tab order on the new screens (the primitives were checked in M1).
- `.expo/types` (typed routes) is regenerated when Metro starts, so run `npx expo start` once after adding routes before `tsc`.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src` or `docs`. R-03 PASS on the emulator at 1080x2340, nothing clipped; wide layouts are M8.
- R-17, R-18, R-36, R-38 PASS: no statistics, quotes or claims. R-23 PASS: no new logo or avatar; the welcome and empty states reuse the existing mascot, the splash the existing logo.
- R-24 PASS: every dock, header and row target exists. R-26 PASS: every button acts (the date chip is disabled where the dialog does not exist).
- R-27 PASS: loading (skeletons), empty and no-result states, import failure banner and a database error screen all exist. Home and History were seen empty, loaded and filtered.
- R-25 PASS: only existing tokens and tones, proven in M1. R-34 PASS: dark and light both seen on Home, Indonesian and English both seen.
- R-35 PASS: run on emulator and web, click-through recorded above. R-32 not re-run for the new screens (see limitations).
- R-39 PASS: dock and icon buttons carry names, fields have visible labels, the search box has a placeholder and an accessibility label, reduced motion is honored by every animation (the splash fade, the ring, the snackbar).
- R-01, R-10, R-12, R-13 PASS: one glow and one glass hero on Home, the dock and the snackbar are the only other shadows. R-04 PASS: icons are by meaning. R-08, R-09 PASS: no decorative arrows or badges.
- R-05 PASS: Home, History, the sheet and Settings each have their own composition. R-15 PASS: buttons say what they do ("Record expense", "Save changes").

Result: PASS, with the limits above recorded, not hidden.

## Next

M4 starts only when the owner says so: goals with deposits and withdrawals, the budgets screen with alerts, insights for a month and a year, CSV and PDF export, recurring management and the typed-confirmation reset. Restart your own Metro on port 8081 with `--clear` before you run the app from your terminal.
