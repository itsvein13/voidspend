# VOIDSPEND v2, milestone M2: data layer

Branch `v2-redesign`, 18 November 2026. Nothing is committed. M3 (core experience) has not started and needs the owner's go-ahead. The v1 screens still read AsyncStorage: the new data layer is not wired into them yet, on purpose.

## Status

| Item | Result |
|---|---|
| SQLite schema, migration runner, seeded categories and default wallet | Done |
| Repositories: transactions, categories, goals, budgets (effective month), recurring rules, meta | Done |
| Finance math (`src/lib/finance.ts`), dates (`dates.ts`), recurrence (`recurrence.ts`) | Done, pure and tested |
| One-time v1 import: backup file, one transaction, sum checks, report | Done |
| Recurring engine for salary and bills (confirm and auto modes) | Done |
| Database provider and hooks (`useQuery`, `useWrite`) | Done |
| Dev screen `dev-data` to try all of it on a device | Done |
| Typecheck, lint, Jest (22 suites, 324 tests), `expo-doctor` (21 of 21) | All green |
| Android emulator and web preview runs | Done, same numbers on both |
| Import screen for people, "Make this a recurring salary" offer, reminders | Not in M2: M3 and M4 |

## What was added

- `src/db/types.ts`: the `Db` interface (the slice of expo-sqlite the app uses), type unions and `ValidationError`.
- `src/db/migrations/001_init.ts`, `migrate.ts`: the full v2 schema from the plan, `PRAGMA user_version`, one transaction per migration.
- `src/db/repo/*`: plain functions that take a `Db`. `transactions.ts` also has month totals, category totals, search and filters, soft delete and a 30 day purge.
- `src/db/legacy/*`: `parse.ts` (reads and validates v1 keys), `labels.ts` (emoji labels in English and Indonesian to category keys), `plan.ts` (pure mapping to rows), `import.ts` (orchestration and checks), `backup.ts` (file on a phone, browser storage on web), `sample.ts` (made-up v1 phone for tests and the dev screen).
- `src/db/DatabaseProvider.tsx`: opens the file, migrates, then renders children. `useQuery(key, fn)` runs again after every write or key change.
- `src/lib/dates.ts`, `finance.ts`, `recurrence.ts`, `ids.ts`.
- `src/i18n`: `categories` labels in both languages and `categoryLabel()`.
- `metro.config.js` and `web.output: "single"`: needed by expo-sqlite on web (see below).

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| Repositories take a `Db`, tests run on Node's built-in SQLite | Tests execute the real SQL, indexes and CHECK constraints. A mock would only test itself |
| Time is an epoch plus the offset, zone and local date stored at entry | A 23:30 coffee in Jakarta stays on its date after a trip, and no time zone database is needed on Hermes |
| Money is integer rupiah, always above zero, the direction is the type | No float rounding, and a sign cannot disagree with a type |
| Validation runs before the write and throws a coded `ValidationError` | Web SQLite errors are generic, and the UI needs a code to explain what to fix |
| Places are rounded to 3 decimals (about 110 m) | A spending history needs the area, not the doorstep |
| Soft delete, purge after 30 days | Powers Undo and "recently deleted" |
| A budget row applies from its month until a later row replaces it | Changing a limit does not rewrite history. v1 budgets import as `2000-01` so they keep applying everywhere |
| Recurring: unique index on (rule, day), a skip only moves the rule on | Running twice or after a crash never double-books a salary |
| Import order: raw backup first, one transaction, check against sums computed from the v1 arrays, then the done marker in the same transaction | Any failure rolls back and the v1 keys stay untouched, so the person can go back |
| Import ids are deterministic (`legacy_ref`, hashed goal and category ids) and a repeated v1 id gets `#2` | A rerun inserts nothing twice, and v1's `Date.now()` ids can collide |
| A v1 row keeps its stored month even when its id falls in another month locally | Month totals must equal what v1 showed. The row goes to noon on the 1st of its stored month |
| Unknown v1 category labels become categories of the person's own | No history is merged by guesswork |

## Verification

Automated: `npx tsc --noEmit` exit 0; `npx eslint .` 0 errors and the same 2 old warnings in v1 files; Jest 22 suites and 324 tests, 104 of them new in this milestone (dates 9, finance 23, recurrence 10, migration and constraints 12, repositories 18, recurring 9, import 20, hooks 3); `npx expo-doctor` 21 of 21.

The import tests use a fixture shaped like a real v1 phone: English and Indonesian labels, 0-based months, a duplicate id, an id outside its month (and one that crosses midnight into the next month locally), a zero salary, a blank name, an unknown category, savings with and without targets, one row with a zero amount. They check that counts and per-month totals equal the v1 sums (July 4,416,000 and August 4,543,000 left, the numbers v1's own formula gives), that a second run is a no-op, that a lost done marker still inserts nothing twice, and that an unreadable file, a failed backup, a totals mismatch and a write that fails halfway all roll back with the v1 keys untouched.

Emulator (Android 11, Expo Go, `dev-data` screen, own database file `voidspend-dev.db`): the database opened and migrated to version 1; "Import sample v1 data" showed "Imported and checked" with the same counts, wrote the backup file to the app's documents folder, and listed the months with the same remaining amounts; a second tap showed "Already imported"; "Add expense Rp 25.000 now" was stored with the emulator's own time (`2026-11-18 17:32`). Web preview: the same screen and the same numbers, `crossOriginIsolated` is true, console clean. The real v1 keys and the real database were not touched.

## Web preview needs two settings

expo-sqlite on web is a WebAssembly build. Without them the whole web bundle fails to resolve `wa-sqlite.wasm`, even for the v1 pages (this happened during M2 and was fixed):

- `metro.config.js`: `wasm` as an asset type, and COEP and COOP headers for cross-origin isolation.
- `app.json`: `web.output` is now `"single"` instead of `"static"`. This changes only the web export. Android is unaffected.

## Known limitations and open items

- Not wired into the v1 screens. They keep using AsyncStorage until M3 replaces them. Until then the import is only reachable from `dev-data`.
- The dev screen has two import buttons. "Real" reads the v1 keys and writes the dev database only. The real database is first opened by M3.
- Import is not triggered automatically, and there is no screen for people yet (planned for M3).
- Tests need Node 22.5 or newer (`node:sqlite`). Node 24 was used.
- Expo Go ran the database fine. A development build is still not needed before M5.
- Receipts, tags and wallet screens have tables but no repositories yet (M5, M4, M9).
- No performance numbers were measured.

## Next

M3 starts only when the owner says so: the new shell (dock), Home, the add and edit sheet, history with search and undo, splash and onboarding, and the trigger and report screen for the import.
