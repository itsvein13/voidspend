# VOIDSPEND v2, milestone M9b: closing the small wallet gaps

Branch `v2-redesign`, 19 November 2026. Nothing is committed. M9 listed four gaps in its open items: editing a transfer, a wallet picker on the recurring screen, a starting balance below zero, and Insights by wallet. This note closes all four. No migration was needed, and no dependency was added.

## Status

| Item | Result |
|---|---|
| Edit a transfer: amount, From, To and note, from the detail screen and from the swipe in History | Done. Verified on the emulator from the detail screen, including Undo |
| The transfer detail screen names the two wallets (From and To) | Done, verified on the emulator |
| A wallet picker on each recurring rule, shown only when there is more than one wallet to pick | Done, verified on the emulator, and the rule keeps the choice after reopening |
| A starting balance below zero, for a credit card or a loan, as a switch next to the amount | Done, verified on the emulator |
| Insights for one wallet: totals, comparison, categories, bars and merchants | Done, tested, verified on the emulator |
| History opened from an Insights slice keeps the wallet | Done, verified on the emulator |
| CSV and PDF export respect the wallet chosen in Insights | Done. The PDF subtitle is unit tested, the CSV filter is unit tested, neither was shared on a device |
| Typecheck, lint (0 problems), Jest (36 suites, 495 tests) | All green |

## How it behaves

1. **Edit a transfer.** On the detail screen of a transfer, Edit opens the transfer screen filled with the current wallets, amount and note. Save changes updates the same row, so the balances of all wallets involved move at once, and a snackbar offers Undo that puts the old values back. In History, a transfer row now swipes right to edit like an expense does.
2. **A hidden wallet does not break an edit.** The edit screen offers the visible wallets plus the two the transfer already uses, so a wallet hidden after the transfer was made is not swapped for another one by accident.
3. **Recurring wallet.** Each rule on the Recurring screen shows a Wallet row of chips when there is a choice. It changes where the next occurrence is recorded and never what was already recorded. A rule whose wallet has since been hidden still shows that wallet as selected.
4. **Starting balance owed.** The amount field only takes digits, so a balance below zero is a switch, "Starting balance is owed", with a line saying it is for a credit card or a loan. The wallets screen shows the balance in red with a minus sign and the total across wallets goes down accordingly. A transfer into the card pays it down.
5. **Insights by wallet.** When there is more than one wallet, the chips "All wallets" and one per wallet sit under the period. The numbers are what was recorded in that wallet. A transfer is never counted, because moving money is not earning or spending it. For one wallet the headline says "Net this period" instead of "Left", and it is not drawn in red, because it is what moved through the wallet and not what the wallet holds.
6. **Exports.** The PDF for one wallet says so in its subtitle ("November 2026, BCA") and uses the same "Net this period" label. The CSV for one wallet lists what was recorded in it plus the transfers in and out, which is what History shows for that wallet.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| A switch for "owed", not a minus key | The keypad and the field take digits only, and a switch with a spoken label is clearer than a sign typed into a number |
| The wallet filter in History moved from screen state to a route parameter | Insights can then open History on the same wallet, so the list adds up to the slice that was tapped. The category filter already worked this way |
| "Net this period" for one wallet | "Left" means what remains of the salary. For a wallet it would read as the balance, and a wallet holding Rp 1.000.000 would look overdrawn |
| An edit uses the existing update path and a new title | The title ("Main to BCA") is built from the wallet names, so it follows the wallets when they change |
| A transfer keeps its time when edited | The edit screen has no date or time field, and the moment it was made is still true |
| No wallet picker when there is nothing to pick | The common case, one wallet, stays as simple as before |

## A bug found on the way

A wallet whose starting balance was negative (possible only through a restored backup before this change) opened the form with an empty amount, and saving it would have set the balance to zero without telling anyone. The form now reads the sign and shows the amount with the switch on.

## Verification

Emulator (Android 11, Expo Go, a fresh database after the PC restart):
- A wallet "BCA" (Bank, 1.000.000) and a card "Kartu_kredit" (Bank, 750.000 owed, typed with an underscore because `adb` cannot type a space) were created. The Wallets screen showed Main 5.000.000, BCA 1.000.000, the card in red as −Rp 750.000, and "Across all wallets" 5.250.000, which is the sum.
- A transfer of 250.000 from Main to BCA left the total at 5.250.000. Its detail screen showed From Main and To BCA. Edit opened filled in. Changing it to the card and 400.000 and saving gave "Transfer updated" and the History row "Main to Kartu_kredit". After a second edit to 100.000, Undo restored 400.000.
- History filtered by wallet: the card showed "Nothing matches", BCA showed the transfer, All wallets showed everything.
- An expense of 100.000 (Food, Warung) was recorded in BCA and one of 30.000 (Transport, Gojek) in Main. Insights for all wallets said 4.870.000 left. BCA said Net this period −Rp 100.000 with spending 100.000 and income 0. Main said 4.970.000 with spending 30.000. The card said "No data in this period".
- With BCA selected, "See Food transactions" opened History with the Food filter and the BCA chip selected, listing the 100.000 expense.
- A monthly salary rule was created. Its card showed the Wallet chips, BCA was picked, "Changes saved" appeared, and BCA was still selected after leaving and reopening the screen.

Tests added: the form's reading of a signed starting balance (round trips, no minus zero), a balance below zero in the repository and a transfer paying it down, editing a transfer (new amount and wallets move the balances, refused same-wallet and zero amount leave it as it was, the values Undo puts back), the wallet of a recurring rule (changes the next occurrence only, refuses an unknown wallet, survives an amount change), and Insights for one wallet (only that wallet, no transfers, the comparison inside the wallet, the sum of wallets equals the whole, an empty wallet, the report subtitle and label, the export filter).

Not run: the swipe-to-edit on a transfer row in History (the same code path as the detail Edit, different entry), editing a transfer whose wallet is hidden, the recurring rule actually posting into the chosen wallet on its due day (covered by a repository test), sharing the CSV or the PDF for one wallet, TalkBack on the new chips and switch, more than three wallets, and `expo-doctor` (no dependency changed).

## Known limitations and open items

- Three items first listed here were closed in `docs/v2-m10-remaining-features.md`: a date and time on a transfer, a "By wallet" list on a goal, and a wallet on the salary setup. A deposit into a goal still counts as "saved" for the wallet it was taken from in Insights.
- A wallet's currency is always IDR.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src`, `docs` or the README.
- R-04 PASS: no new icons were added.
- R-17, R-18, R-36, R-38 PASS: every number above comes from the run on the emulator or from a test.
- R-23 PASS: no new logo, avatar or illustration.
- R-26 PASS: every new control acts: the wallet chips in Insights, the Wallet chips on a recurring rule, the owed switch, the Edit button on a transfer. They are hidden when there is nothing to choose.
- R-27 PASS: the edit screen has loading and "not found" states, Insights has its empty state for a wallet with nothing in the period, and errors are in words.
- R-35 PASS for what was run (listed above), and the paths not run are named.
- R-39 PASS: the chips and the switch carry their labels as accessible names, and the switch has a description. The netted amount reads as "Rp 100.000" with its sign.

Result: PASS.

## Next

The plan's milestones M0 to M9 and this follow-up are done. The release (version 2.0.0, a build, a store upload) still waits for the owner's go-ahead.
