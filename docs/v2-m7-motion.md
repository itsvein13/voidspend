# VOIDSPEND v2, milestone M7: motion and hero polish

Branch `v2-redesign`, 18 November 2026. Nothing is committed. The charts now ease between values, the month switch on Home slides in from the side it came from, and a deleted History row fades out while the rows below close the gap. Reduced motion turns every one of these off. The optional Skia hero (M7b) was **not built**, with the reason below. Frame rate and cold start were **not measured**: the only device here is an x86 emulator, whose numbers would not describe a phone.

## Status

| Item | Result |
|---|---|
| Void ring: arc drains with a spring, drop falls into the gap, color steps lime, amber, red | Done in M1 and M3, unchanged |
| Amount counter rolls in tabular figures | Done in M1 and M3, unchanged |
| Goal and budget rings (`ProgressRing`) ease to a new value and grow in the first time | Done, verified on the emulator (a goal at 3 percent drew its arc) |
| Category donut (`Donut`): each slice eases its length and start between datasets | Done, verified on the emulator (the slices drew correctly in Insights) |
| Month bars (`Bars`): bars grow from the baseline and ease when the data changes | Done |
| Month change on Home: content slides in from the side the month moved from (200 ms) | Done, month change verified on the emulator; the slide itself is too quick to catch in a still |
| History: a deleted row fades out and the rows below close the gap | Done, verified on the emulator (delete, snackbar, no error) |
| Press feedback, save and warning haptics, snackbar with Undo, skeletons | Done in M1 to M4, audited here |
| Reduced motion: system setting or the in-app switch | Audited, every animated piece reads it |
| Optional Skia hero (M7b) | **Not built**, see decisions |
| Typecheck, lint (0 problems), Jest (30 suites, 441 tests), `expo-doctor` (21 of 21) | All green |

## The motion inventory, as it stands

| Interaction | Purpose | How |
|---|---|---|
| Ring drain and the falling drop | Shows what an entry did | Spring on the arc, a drop that falls into the gap |
| Counter roll | Same | Tabular figures that roll |
| Goal ring, donut, bars | Show a change between periods and datasets | `useEased`: one 320 ms ease-out tween on the UI thread, starting at zero the first time |
| Month change | Direction | Fade and a 25 px slide from the side the month moved from, 200 ms |
| Delete in History | Keeps the reader's place | Row fade, 120 ms, and a 200 ms layout transition for the rows below |
| Press | Confirms the touch | Scale and a light haptic on buttons, a selection haptic on chips and the keypad |
| Save | Trust | Success haptic and a snackbar with Undo |
| A budget limit crossed | Warning | Warning haptic and a banner, no shake |
| Skeletons | Only where waiting is real | Static blocks, and a pulse that stops under reduced motion |

No animation loops anywhere, so nothing costs battery while the app sits on a screen.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| One hook, `useEased`, for every chart mark | Reduced motion and the first-show growth are decided in one place, and each mark is a small component with its own shared value |
| Donut slices keep their start position on first show and only grow in length | A start that sweeps in from zero would make slices fly around the ring |
| The ring arc hides below 0.2 percent | A round cap draws a dot at zero length, which reads as a value |
| The month slide is a fade with a 25 px offset, not a full-width slide | A full-width slide of a tall page looks heavy and costs more to draw |
| No swipe gesture for the month | Home scrolls vertically and the chevrons are 44 px targets. A horizontal pan would compete with scrolling, and nothing in the plan needs it |
| M7b (Skia) not built | The SVG ring already does everything the hero needs. Skia adds a native dependency whose size could not be measured without a build, and the plan said to build it only if the cost is accepted. There is nothing to compare against yet |

## Verification

Emulator (Android 11, Expo Go):
- Insights: the donut drew with correct proportions (Shopping about three quarters, Food one quarter) and the thin gap between slices.
- History: swiping a row left deleted it, the snackbar showed "Transaction deleted" with Undo, the remaining rows closed up, and no error toast appeared.
- Home: the previous month button showed October with its own (empty) numbers, the next month button returned.
- Goals: a new goal with a 25.000 deposit showed a 3 percent blue arc and the text "3%".

Tests: `useEased` has four tests that prove where a value starts (zero, a given start, the target under reduced motion, the target when a mark turns animation off). The Reanimated mock finishes tweens at once, so the easing itself is checked by eye, not by Jest.

Not run: the easing frames themselves (a still screenshot cannot show them), TalkBack, and a measured frame rate.

## Known limitations and open items

- Frame rate during scrolling and the animations, cold start time and APK size are not measured. The plan's budget (60 fps on a mid-range phone, Home under 2 seconds) needs a real phone or an EAS build.
- A layout animation inside a `SectionList` is less predictable than one in a plain list. It worked on the emulator, and a phone with a long list should be checked.
- The slide on month change remounts the Home content, so the ring does not spring on a month switch. It springs when an entry is added.
- The Insights month switch and the History filter changes do not slide. Only Home does.

## antislop Delivery Gate (mode `during`, ENERGY 2 / RHYTHM 2 / MOTION 2)

- R-02 PASS: no U+2014 in `src` or `docs`.
- R-19 PASS: nothing loops. Every animation answers a user action or a data change, and each one has a reason in the inventory above.
- R-26 PASS: nothing new is clickable, and nothing decorative moves.
- R-35 PASS for what was run (listed above), and the unrun parts are named.
- R-39 PASS: reduced motion (system or the in-app switch) removes the slide, the fade, the chart tweens, the ring spring and the drop. State changes then happen at once, and they are still announced in words.
- MOTION dial 2: motion is present and purposeful, never a spectacle. Matches the setting.

Result: PASS, with the performance budget recorded as unmeasured and M7b recorded as not built.

## Next

M8 (responsive layouts, accessibility pass, backup and restore, app lock, recently deleted, README update, final Delivery Gate) follows the plan.
