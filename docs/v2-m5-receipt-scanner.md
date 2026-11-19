# VOIDSPEND v2, milestone M5: receipt scanner

Branch `v2-redesign`, 18 November 2026. Nothing is committed. The scanner flow, parser, review and storage are built and verified. The on-device text reader is written but cannot run until a development build exists, so it is **not verified**.

## Status

| Item | Result |
|---|---|
| Receipt parser (amounts, total, subtotal, tax, service, discount, rounding, items, quantities, date and time, merchant, payment) | Done, 28 tests on made-up receipts |
| Review state, totals check, category suggestion, duplicate detection | Done, tested |
| Receipts in the database: draft, confirm in one transaction, discard, items | Done, tested against real SQLite |
| Scan screen (camera, gallery, processing with cancel, problem states) | Done |
| Review screen (photo, every field editable, lines add and remove, totals check, category, payment, note, duplicate warning) | Done, 5 component tests, verified on the emulator |
| "Finish reviewing" card on Home, "Keep receipt photos" setting | Done |
| Photo pipeline (copy, fingerprint, reader, manual review with the photo) | Verified on the emulator with a bundled picture |
| Text reader: local Android module `modules/receipt-scan` with Google ML Kit | Source written, **not compiled, not run** |
| Typecheck, lint (0 problems), Jest (28 suites, 420 tests), `expo-doctor` (21 of 21) | All green |

## How a scan goes

1. Choose a photo (camera, gallery). The app keeps a copy in its own folder and fingerprints it (SHA-256). A photo that was already saved shows a strong warning first.
2. The photo is read on the device. A cancel button stops waiting. No reader (Expo Go, web) means the person goes straight to manual review with the photo above the fields. Empty text and failures say so and offer "Fill in myself" or "Retake".
3. The parser rebuilds rows by height, so a name stays next to its price, and reads the merchant, date, time, lines, total and payment method.
4. The review screen is mandatory. Every field is editable, what the reader was unsure about is marked, and the lines are checked against the total (a rounding line of up to Rp 500 is tolerated). Save stays off until there is a total. Nothing else is required: with no category chosen the expense goes to Other.
5. Saving writes the lines, the expense and the receipt status in one database transaction, so a crash leaves the draft as it was and a double tap cannot add two expenses. A draft survives closing the app and comes back as a card on Home.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| On-device reader (ML Kit) plus our own parser | Free, offline, and the photo never leaves the phone, which keeps the app's promise |
| The parser is pure TypeScript with the reader behind one function | Every rule is tested on text, and a different reader can be swapped in without touching the rest |
| A total that does not match the lines is marked low, never silently fixed | The person decides, the app only points |
| Tax lines that say "included" are not added a second time | Minimarket prices already contain it |
| Future dates fall back to today | A misread year must not record tomorrow |
| Category: last used for the same merchant, then a small keyword table | Learns from the person, no AI |
| Same photo is a strong warning, same total and day at a similar merchant a soft one | A real second purchase must stay possible |
| A discarded receipt clears its photo path, text and draft | Nothing is kept that the person threw away |

## Verification

Emulator (Android 11, Expo Go):
- The scan screen opened from Home. "Use a sample receipt" (development only) filled the review with Indomaret, Rp 15.500, three lines, category Shopping marked "Suggested" and payment Cash. Saving showed "Receipt saved" with Undo and Home counted the spend; the saved row read "Indomaret, Shopping, 14:32".
- Scanning the same receipt again showed "Looks like Indomaret, 18 Nov, Rp 15.500, which is already recorded." and the button changed to "Save anyway".
- Leaving the review unsaved put "Finish reviewing: Indomaret, Rp 15.500" on Home. Continue reopened it and Discard removed it.
- "Use a sample photo" (development only) sent a bundled picture through the real photo pipeline: copy, fingerprint, no reader, then manual review with the photo above, the banner "Text reading is not available in this version", the unread fields marked and Save off. Discarding deleted the copy.

Not run on a device: the camera (it needs a permission dialog), the system gallery picker with a real image (the emulator picker did not list the pushed test file), and the ML Kit module.

### Defects found and fixed in this milestone

| Defect | Fix |
|---|---|
| Regex escapes were stripped by my shell edits and broke the date mask | Rewritten in the file and covered by tests |
| Item names scrolled sideways in narrow fields | The name is on its own full-width row above the price |
| "Indomaret" was said twice in a row's subtitle | The merchant is left out when it equals the title |

## Known limitations and open items

- **The ML Kit module has never been built.** `modules/receipt-scan` (Kotlin, `expo-module-gradle-plugin`, `com.google.mlkit:text-recognition:16.0.1`) follows the Expo Modules API but may need small fixes at first build. It needs a development build: a local Gradle toolchain or an EAS build, both of which need the owner's go-ahead.
- No pinch zoom on the photo, only a full-screen view.
- The document scanner (crop and perspective) was left out, as the M0 notes said the flow must work without it.
- The camera path and the real gallery path were not exercised on a device.
- Parser accuracy is only as good as the made-up fixtures. Real paper receipts from the owner are needed to tune it.
- Receipt photos are stored as a copy in the app folder and are not part of any backup yet (M8).

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src` or `docs`. R-03 PASS on the emulator.
- R-17, R-18, R-36, R-38 PASS: no statistics or claims; the sample receipts are labeled development only and are made up.
- R-23 PASS: no new logo, avatar or illustration. The sample photo is the existing logo.
- R-26 PASS: every control acts; the development buttons are hidden in a release build.
- R-27 PASS: processing, unavailable, empty, error and duplicate states all exist.
- R-35 PASS for what was run (listed above), and the unrun paths are named.
- R-39 PASS: the photo has a label and a "view larger" action, remove buttons carry the line name, warnings are words, not only color.
- R-36 note: nothing claims the reader works. The screen says plainly when it is not available.

Result: PASS for the flow, with the unverified native reader recorded.

## Next

M6 (location) and the later milestones continue by the plan. Before any real receipt is scanned, a development build is needed to compile and test the ML Kit module.
