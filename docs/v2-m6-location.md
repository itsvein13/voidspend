# VOIDSPEND v2, milestone M6: location

Branch `v2-redesign`, 18 November 2026. Nothing is committed. A transaction can carry a place, typed or read once from the device. The typed path and everything around it are verified on the emulator. Reading the real device position could not be run there, so that path is **not verified on a device**.

## Status

| Item | Result |
|---|---|
| Place section in the add and edit sheet (typed name, "Use current location", clear) | Done, verified on the emulator for the typed path |
| One-shot reading: permission, services check, last known position, one balanced reading with an 8 s limit, name lookup | Done, 17 tests in all for the reading, the data and the sheet, with the native module mocked |
| First-use explanation before the system prompt | Done, tested |
| Denied, permanently denied (with "Open settings"), services off and timeout states | Done, tested; the "not available" state verified on the emulator |
| Detail screen shows the place, and "Open in Maps" when there is a point | Done; the place shown on the emulator, the Maps link tested as a pure function |
| Settings: allow or hide the feature, delete every saved place | Done, verified on the emulator ("2 locations deleted", transactions kept) |
| Export: places left out unless the person ticks "Include places in the export" | Done |
| Typecheck, lint (0 problems), Jest (29 suites, 437 tests), `expo-doctor` (21 of 21) | All green |

## What the person sees

1. In the add sheet there is a Location section: a "Place name" field (optional) and a "Use current location" button. Typing a name is always possible and needs no permission.
2. The first tap on "Use current location" explains in the app what will happen: the location is read once, only on this tap, kept on this phone and rounded to about 110 meters. "Continue" then triggers the system permission prompt.
3. A reading uses a recent known position when there is one (up to 5 minutes old), otherwise one balanced reading with an 8 second limit. The address is looked up for a readable name, for example "Jl. Sudirman, Tanah Abang, Jakarta". If the lookup fails (offline), the point is kept and the name field stays editable.
4. A refusal says so and leaves typing available. If Android will not ask again, a button opens the system settings for the app.
5. The detail screen shows the place. When a point was saved, "Open in Maps" hands a `geo:` link to whatever maps app the phone has.
6. Settings has "Allow adding a location" (off hides the whole section) and "Delete all saved locations", which clears names and points but keeps every transaction.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| Foreground, one-shot only. No watching, no background use, never automatic | The app promises that nothing runs without the person asking. The config plugin also turns background location and the foreground service off |
| Coordinates are rounded to 3 decimals by the repository | About 110 m is enough to recognise a place and not enough to pinpoint a doorstep |
| Typed place works without any permission | Location is a convenience, not a requirement |
| An explanation before the first system prompt | The system prompt alone does not say what the app does with the reading |
| `readCurrentPlace` never throws and maps every native failure to "unavailable" | See the defect below. The UI always has a state to show |
| Places are left out of exports by default | A CSV is shared outside the app, so including places needs a tick |
| Duplicating a transaction does not copy its place | A repeat purchase is usually somewhere else |

## Verification

Emulator (Android 11, Expo Go, fake GPS fix set over `adb`):
- "Use current location" showed the in-app explanation, then the system permission prompt. After the fix below, the reading ends in the banner "Location is not available right now. Check that location services are on, or type a place name." with the name field still usable.
- A typed place ("Warung Bu Tini") was saved with an expense. The detail screen shows it under "Location", with no "Open in Maps" because there is no point.
- Settings: "Delete all saved locations" showed "2 locations deleted".

Not run on a device: a real reading, the reverse lookup of a real address, and the Maps hand-off. The emulator image has no Google Play services, and Expo's location module needs them, so every reading is rejected there.

### Defect found and fixed in this milestone

| Defect | Fix |
|---|---|
| On the emulator the native location call rejected, the rejection went through `Promise.race` and out of `readCurrentPlace`, and the button handler left it unhandled, which showed a red "Uncaught (in promise)" toast | `readCurrentPlace` now catches everything and returns "unavailable". A failed last-known read falls back to a fresh reading. The timeout timer is cleared once the race ends. Two tests cover it. The message now says location is not available right now, rather than blaming the services switch |

## Known limitations and open items

- The real reading and the Maps hand-off need a phone or an emulator image with Google Play services. Try both before release.
- A receipt's address line, when the parser finds one, is saved as a typed place with source `receipt` (built in M5, covered by the parser and receipt tests). It carries no coordinates, so it has no "Open in Maps" link.
- Names come from the system's reverse lookup, which needs a network. Offline, the person types the name.
- There is no map preview and no "places I go often" list. Neither was planned.
- No place filter in History yet.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src` or `docs`.
- R-17, R-18, R-36, R-38 PASS: no numbers or claims beyond what the code does. The "about 110 meters" figure matches the 3 decimal rounding.
- R-23 PASS: no new logo, avatar or illustration.
- R-26 PASS: every control acts, and the Maps link only shows when there is a point.
- R-27 PASS: reading, denied, not available and timeout states all exist, each in words and not only color.
- R-35 PASS for what was run (listed above), and the unrun paths are named.
- R-39 PASS: the button and the field carry accessible names, the reading state is announced politely, and the banner says what happened and what to do next.

Result: PASS for the flow, with the device reading recorded as unverified.

## Next

M7 (motion and hero polish) follows the plan.
