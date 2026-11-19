# VOIDSPEND v2, milestone M9: wallets and transfers

Branch `v2-redesign`, 18 November 2026. Nothing is committed. The wallet screens, transfers, balances and the wallet filter are built and were run on the emulator. The schema was ready from the first migration, so this milestone adds no migration.

## Status

| Item | Result |
|---|---|
| Wallets: create, rename, kind, starting balance, hide and show again. The main wallet cannot be hidden | Done, 11 repository tests |
| Balance of each wallet: starting balance, plus income and savings taken out, minus spending, savings put in and transfers out, plus transfers in | Done, tested, verified on the emulator |
| Transfer between two wallets, saved as a `transfer` transaction | Done. It leaves a month's income, spending and savings alone (tested and seen on Home) |
| Wallets screen with the total, one row per wallet, and the hidden ones | Done, verified on the emulator |
| Transfer screen, with From and To pickers that swap rather than allow the same wallet twice | Done, verified on the emulator |
| Wallet picker in the add and edit sheet, shown only when there is more than one wallet | Done, the section appeared on the emulator |
| Wallet balances on Home, shown only when there is more than one wallet | Done, verified on the emulator |
| Wallet filter in History, counting transfers in and out | Done, tested and verified on the emulator |
| Delete all data also removes the wallets the person made and zeroes the main one | Done, tested |
| Backup and restore carry wallets | Already true (the wallets table is in the backup) |
| Typecheck, lint (0 problems), Jest (35 suites, 478 tests), `expo-doctor` (21 of 21) | All green |

## How it behaves

1. The app starts with one wallet, "Main". Nothing about wallets shows anywhere until a second one exists, so a person who never needs them never sees them.
2. Settings, then Wallets, lists them with what each holds and a total. "New wallet" asks for a name, a kind (Cash, Bank, E-wallet, Other) and a starting balance, which is what the wallet holds now.
3. "Move money" picks From, To and an amount. It is recorded as one transaction titled for example "Main to BCA", and appears in History with a neutral amount.
4. Income and spending go to the wallet picked in the add sheet, the main one unless changed.
5. A hidden wallet disappears from the pickers. Its transactions stay and still count in its balance and in the total.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| A transfer is one row with two wallets, not two rows | One row cannot be half deleted, and Undo or delete moves both sides at once |
| A transfer is outside income, spending and savings | Moving money is not earning or spending it. The "left this month" number stays what it was |
| The total across wallets is shown, but there is no total on Home's ring | The ring is about the month's salary. Wallet balances are about where the money is |
| No negative starting balance in the form (changed in M9b: a switch "Starting balance is owed") | A card owing money is possible in the data, but the amount field takes digits only |
| Archived wallets keep their transactions | Deleting a wallet would delete history or force a choice of where it goes |
| Wallet pickers appear only from the second wallet | The common case, one wallet, stays as simple as before |
| Balances are computed from transactions and are not stored | A stored balance can drift from the rows. This one cannot |

## Verification

Emulator (Android 11, Expo Go):
- A wallet "BCA" (Bank, starting balance 1.000.000) was created. The Transfer screen listed Main and BCA, with Main as From and BCA as To.
- Moving 250.000 showed "Money moved". The Wallets screen then showed Main 4.709.500, BCA 1.250.000 and "Across all wallets" 5.959.500, which equals the old Main balance (4.959.500) plus the 1.000.000 starting balance.
- Home still said 4.959.500 left of 5.000.000, so the transfer did not change the month. Home showed a Wallets card with both balances.
- History with the BCA filter listed only "Main to BCA, Transfer".
- The add sheet showed a Wallet section.

Tests: the balance rules in every direction, a deleted row, a row without a wallet, the total across wallets staying equal to what came in and went out, a transfer staying out of the month totals, the same-wallet and no-wallet transfer errors, the wallet filter, the name rules, and the reset.

Not run: a negative starting balance, many wallets (the chips wrap, but five or more was not looked at), TalkBack on the new screens.

## Known limitations and open items

Three of the four items first listed here were closed in `docs/v2-m9b-wallet-gaps.md` on 19 November 2026: editing a transfer, a wallet picker on the recurring screen, and Insights by wallet. A starting balance below zero, listed under "Not run" above, is closed there as well.

- A wallet's currency is always IDR.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src`, `docs` or the README.
- R-04 PASS: the screens use the existing icon set, only for relevant actions.
- R-17, R-18, R-36, R-38 PASS: the balances shown are computed from real rows, the example numbers above come from the run, and the README says what is not verified.
- R-23 PASS: no new logo, avatar or illustration.
- R-26 PASS: every control acts. The wallet pickers and the balance card are hidden when they would have nothing to do.
- R-27 PASS: the wallets screen has loading and list states, the transfer screen has a "needs two wallets" state with a way forward, and errors are in words.
- R-35 PASS for what was run (listed above), and the unrun paths are named.
- R-39 PASS: every new control has an accessible name, and the amounts read as "Rp 1.250.000".

Result: PASS.

## Final delivery gate for the whole v2 redesign

What the owner needs to know before a release (each item is also in the milestone notes):

- **Never run on a device:** the ML Kit text reader (module written, never compiled), a real location reading, the camera, the PDF share, the backup share and the file picker result.
- **Not measured:** frame rate, cold start and APK size.
- **Parser accuracy** is based on made-up receipts. Real receipts from the owner are needed.
- **Android automatic backup** to a Google account is still on by default. Decide before release.
- **Not built:** the optional Skia hero (M7b), a two-pane wide layout, tags, the spending calendar, and a place filter. Everything on this list except the Skia hero was built afterwards, see `docs/v2-m10-remaining-features.md`.
- **Nothing is committed** and no build, upload or account change was made.

## Next

The plan's milestones M0 to M9 are done. The release (version 2.0.0, a build, a store upload) waits for the owner's go-ahead.
