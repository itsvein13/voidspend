# VOIDSPEND v2, milestone M1: design system

Branch `v2-redesign`, 18 November 2026. Nothing is committed. M2 has not started and needs the owner's go-ahead.

## Status

| Item | Result |
|---|---|
| Tokens, theme (dark, light, system), preferences, i18n (ID and EN), fonts | Done |
| Primitives, Void ring, horizon glow, layout helpers, dev-only gallery | Done |
| Typecheck, lint, Jest (14 suites, 220 tests), `expo-doctor` (21 of 21) | All green after the last edit |
| Android emulator check (Expo Go, Android 11, 1080x2340) | Done: dark and light, ID and EN, large font, wide screen, reduce motion, Spend and Undo, keypad, amount field |
| Web smoke check (Metro port 8082) | Done: no console errors or warnings, no leaked React Native props in the DOM |
| `expo-blur` | Deferred to M3, when the dock and sheet backdrop exist |
| APK size and cold start | Not measured (no build) |
| Plan file update | Not done: add the findings below to the plan |

## How to open the gallery

The gallery is dev-only (`__DEV__` guard, redirects to Home in a release build) and hidden from the tab bar.

```bash
npx expo start --go --port 8082
```

Open `exp://<your-ip>:8082/--/gallery` in Expo Go, or `http://localhost:8082/gallery` on web (set `hasOnboarded` to `true` first, or finish onboarding). If Metro was already running before the font package was installed, restart it with `--clear`.

## What was built

- `src/design/tokens.ts`, `color.ts`: palettes, type scale, spacing, radii, elevation, motion, breakpoints. Contrast helpers are tested.
- `src/design/theme.tsx`, `DesignProvider.tsx`, `src/lib/PrefsProvider.tsx`, `src/i18n`: theme and language follow the device until the user chooses. Preferences live under `v2.prefs` and migrate the v1 `theme` key once.
- `src/design/primitives`: Text, Amount, RollingText, Surface, PressableScale, Button, IconButton, Chip, Segmented, Field, AmountKeypad, ListRow, SwitchRow, SheetHeader, Skeleton, EmptyState, Banner, Snackbar, Icon.
- `src/design/charts`: VoidRing (300 degree arc, gap at the bottom), HorizonGlow.
- `src/design/layout`: Screen, `useBreakpoint` (compact under 600, medium 600 to 839, expanded 840 and up).
- About 3,250 lines of source and 1,180 lines of tests.

## Decisions, one line of reason each

| Decision | Reason |
|---|---|
| Near-black canvas `#050605`, four surface steps | Pure black leaves no room for depth or shadow |
| Lime is the action and "money left" color, blue is savings, red is a problem only, amber is "near a limit" | Color carries meaning, so expenses are neutral text with a minus sign |
| Dark and light accents differ (`#C8F542` and `#5A9E0F`, with separate "ink" variants for text) | Lime text fails contrast on white, lime fills with near-black text pass |
| Space Grotesk for display and money, Plus Jakarta Sans for text | Keeps the brand face for numbers, adds a text face that stays legible at 12 to 15 px |
| Sentence case, no tracked all-caps in the new system | Tracked caps hurt readability and read as a template |
| Radii by role: 10, 16, 22, 30, full only for avatar and add button | Shape tells inputs, buttons and cards apart |
| Glass on the hero only, one horizon glow capped at 0.16 | Glass and glow are accents, strength is capped so text on top keeps its contrast |
| Void ring, SVG and Reanimated | Reuses the icon's ring motif, no new dependency |
| Reduced motion is the system setting or the in-app switch | Android devices without the system switch still get a way to stop motion |
| Hero amount font scale capped at 1.3, rolling digits use fixed geometry | Digit columns clip at 2.0x otherwise |
| Money format `Rp 25.000` with U+2212 minus and non-breaking space | Matches receipts and never wraps between sign, symbol and digits |

## Verification

Automated: `npm run typecheck` exit 0; `npx eslint .` 0 errors and 2 warnings (both `react-hooks/exhaustive-deps` in v1 files `_layout.tsx` and `FinanceContext.tsx`, untouched until M3); Jest 14 suites and 220 tests (tokens 102, keypad 19, controls 18, prefs 12, feedback 12, ring geometry 11, color 11, money 9, others 26); `npx expo-doctor` 21 of 21.

Contrast was computed, not estimated. The token tests cover every text and fill pair, and a spot check with the antislop script agrees (secondary text on surface 7.95:1, tertiary on surface 5.19:1, near-black on lime 15.32:1, dark outline 4.07:1, light outline 3.66:1, light lime ink on canvas 5.56:1).

Category colors, checked with the dataviz validator, six hued slots plus a neutral "Other" slot:

| Mode | Result |
|---|---|
| Dark, on `#0E100F` and `#161917` | All checks pass. Worst adjacent CVD pair has tritan separation 4.0, so charts need direct labels or gaps |
| Light, on `#FFFFFF` | All checks pass except a WARN: green `#1BAF7A` is 2.82:1 and pink `#E87BA4` is 2.69:1. Charts must show visible labels and offer a table view (obligation for the M4 donut, noted in `tokens.test.ts`) |
| Neutral "Other" | Gray on purpose (5.75:1, 5.33:1 dark, 4.83:1 light). The validator flags it as low chroma when it is included in the set |

Android emulator click-through: theme segmented (System, Dark, Light), language segmented (System, ID, EN), Reduce motion and Touch haptics switches, Spend 250.000, Spend 3.000.000, Add 250.000, Reset, Undo in the snackbar (ring went 2.7 million to 2.45 million and back to 2.7 million), keypad, amount field with grouping, banners, skeleton and empty state. v1 Home and History still render.

Web click-through: Spend then Undo (ring 2.95 million, 2.70 million, 2.95 million), theme switch to Light, Tab order follows the visual order (Spend, Spend, Add, Reset), focus ring visible on buttons, segmented options and fields, console clean.

### Defects found and fixed in this milestone

| Defect | Fix |
|---|---|
| Web keyboard focus drew two rings (ours plus the browser's amber outline) on buttons, segmented options and fields | `outlineStyle: "none"` on web in `PressableScale` and `Field`, the custom ring stays |
| Web console noise: leaked `accessibilityElementsHidden`, invalid `transform-origin`, deprecated `pointerEvents` prop | `aria-hidden`, a `transform` string for the ring rotation, `style.pointerEvents` |
| Segmented indicator missing on cold start, rolling digits clipped at 2.0x font, nested pressable in a row | Indicator always mounted, fixed digit geometry, decorative `IconTile` |

## Known limitations and deviations

- The v1 tab bar and v1 screens follow the v1 theme toggle in Profile, not the new theme setting. In the gallery, Light leaves the v1 tab bar dark. Both go away when M3 replaces the shell.
- Expo Go draws its own black status bar strip, so light-theme status bar icons cannot be judged there. Check in a development build.
- The v1 screens still use tracked all-caps labels until M3.
- Skeleton pulse loops while shown and stops under reduced motion. It is loading feedback, and the in-app switch is the stop control.
- `expo-blur` was planned for M1 and moved to M3. Blur cannot be judged on the Android 11 emulator anyway.
- Gallery sample copy (for example "Backup file saved") previews future screens and is not a product claim.
- Small buttons are 40 dp tall with 2 dp hit slop top and bottom, so the touch target is 44 dp. Accessibility bounds on the emulator report 40.
- No performance numbers were measured.

## antislop Delivery Gate (mode `during`, dials ENERGY 2 / RHYTHM 2 / MOTION 2, Design Read in the plan)

Block 1, Hard Gate:
- R-02 PASS: scan for U+2014 over `src`, `docs`, `README.md` returned nothing.
- R-03 PASS: no overflow on the emulator at 1080x2340, at large font and on the wide layout. The only exception is the v1 shell, out of scope.
- R-17, R-18, R-36, R-38 PASS: no statistics, testimonials or claims. Gallery amounts are labeled sample data.
- R-23 PASS: no new logo, avatar or illustration. The empty state reuses the existing mascot.
- R-24 PASS: no new navigation. The gallery is hidden from the tab bar and guarded by `__DEV__`.
- R-25 PASS: token tests plus script cross-check. Chart colors in light need labels (see above).
- R-26 PASS: every gallery control has a behavior (state change or snackbar).
- R-27 PASS: Skeleton, EmptyState and Banner (info, success, warning, danger) exist.
- R-28 N/A.
- R-32 PASS: web Tab order and visible focus ring checked. Native focus is covered by the same ring.
- R-33 PASS: no patch scripts.
- R-34 PASS with a limit: new components are correct in both themes on emulator and web. The v1 shell does not follow (see limitations).
- R-35 PASS: run on emulator and web, click-through recorded above.
- R-37 PASS: Design Read declared in the plan.
- R-39 PASS: pointer cursor on web, accessible names (IconButton requires `label`), visible labels on fields, reduced motion honored.
- R-40 PASS: nothing measured is reported, and no unmeasured number is claimed.

Block 2, Purpose-Gate:
- R-01 PASS: one horizon glow and one glass sheen, both for hierarchy.
- R-04 PASS: icons come from the existing `@expo/vector-icons` sets, chosen by meaning, no sparkle or orb icons.
- R-06 PASS: reasons written in the table above.
- R-07, R-08, R-09 PASS: no grid, no decorative arrows, no badges.
- R-10 PASS: glass appears on the hero only. R-12 PASS: shadow only on `elevated` surfaces and the snackbar. R-13 PASS: one glow.
- R-14 N/A. R-19 PASS: springs for press, ring and digits, no ambient loops except the Skeleton noted above. R-22 PASS: no illustrations added.

Block 3, Liveliness: dials declared; focal point is the ring on the gallery hero; one accent (lime) with blue, red and amber as meaning colors; identity motif is the void ring. PASS.

Block 4, Quality Locks: C-1 to C-5 no violations known beyond the limitations above; radii vary by role (R-11); CTAs are specific (R-15); no buzzwords (R-16); R-21 both themes first class plus system; R-29 neutrals plus one accent, semantic colors by meaning; R-30 not a clone; R-31 reasons written. PASS.

Result: PASS, with the v1 shell theme mismatch and the light-theme chart label obligation recorded as open items, not hidden.

## Next

M2 (data layer: SQLite, legacy import, finance math, recurring engine) starts only when the owner says so. Before M3, restart your own Metro on port 8081 with `--clear` so it sees the new font package.
