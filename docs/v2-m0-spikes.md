# VOIDSPEND v2, milestone M0: foundation and spikes

Branch `v2-redesign`, 18 November 2026. Nothing is committed yet. The approved plan is kept outside the repository, in the Claude Code plans folder (the file ending in `squishy-dove.md`).

## Status

| Item | Result |
|---|---|
| Starter leftovers removed | Done |
| Typecheck, lint and Jest | Done, all green |
| Expo SDK 57 patch set aligned | Done (also fixes a Hermes memory regression) |
| `expo-dev-client`, `react-native-keyboard-controller` installed | Done, not wired into the app yet |
| Spike: on-device text recognition | Go on paper, a device build must confirm it |
| Spike: document scanner | Conditional, decide in M5 |
| Spike: `expo-sqlite` on web | Tested for real, works with caveats |
| Spike: dates and time zones | Design avoids Hermes `Intl`, nothing to test |
| Spike: `expo-blur` on Android | Open, needs a real device |
| Android development build | Not needed yet: Expo Go on the owner's Android 11 emulator works; EAS development build at M5 |
| APK size and cold start baseline | Not measured, needs a build |

## What changed in the repository

- Deleted 41 unused starter files: the starter components and hooks, the `explore` route, `global.css`, `scripts/reset-project.js` and the template images in `assets/images` (only `icon.png` and `favicon.png` are kept). `AGENTS.md` was already deleted in the working tree before M0 and is untouched.
- Removed four unused dependencies and the `expo-web-browser` plugin entry: `expo-device`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`.
- Aligned the Expo SDK 57 patch set: `expo` 57.0.6 to 57.0.33, `react-native` 0.86.0 to 0.86.3, `expo-router` 57.0.6 to 57.0.31, `react-native-reanimated` 4.5.0 to 4.5.1, `react-native-worklets` 0.10.0 to 0.10.1, `react-native-screens` 4.25.2 to 4.26.2, plus the smaller Expo packages. `expo-doctor` reported Hermes V1 `250829098.0.14` with a known memory regression (fixed from `.16`, shipped with React Native 0.86.2 and later). The v1 build that is out today was made from the old lockfile, so it has that engine.
- Added `expo-dev-client` 57.0.21 and `react-native-keyboard-controller` 1.21.9. The keyboard provider is not mounted yet: it changes how the window insets work, so it goes in with the new sheets in M3.
- Added dev tooling: `jest` 29.7, `jest-expo` 57.0.6, `@react-native/jest-preset` 0.86.3, `@testing-library/react-native` 14.1, `test-renderer` 1.3, `eslint` 9.39 and `eslint-config-expo` 57.
- New scripts `typecheck` and `test`; removed `reset-project`. New files `eslint.config.js` and `jest.config.js`. `tsconfig.json` now lists `"types": ["jest"]` because TypeScript 6 no longer loads `@types/*` on its own.
- `src/constants/theme.ts` keeps only the v1 tokens that are still used. `src/app/_layout.tsx` drops the hidden `explore` route.
- Two test files, 7 tests: the v1 money input helpers (`src/utils/format.test.ts`) and a render smoke test (`src/test/render-smoke.test.tsx`).

Workflow change: with `expo-dev-client` installed, `npx expo start` defaults to a development build. To open the app in Expo Go press `s` in the Metro terminal or run `npx expo start --go`.

## Check results

- `npm run typecheck`: no errors.
- `npm run lint`: 0 errors, 2 warnings (`react-hooks/exhaustive-deps` in `_layout.tsx` and `FinanceContext.tsx`).
- `npm test`: 2 suites, 7 tests pass.
- `npx expo-doctor`: 21 of 21 checks pass.
- Web preview of the cleaned v1 (Metro on port 8099): bundles 1009 modules, Home, History, Report and Profile render with the same content as before. The console only shows a dev-only `expo-dev-plugins` WebSocket message and the existing `useNativeDriver` warning.
- On the owner's Android 11 emulator in Expo Go (screenshot over `adb`): Home renders correctly with the upgraded packages and the cleaned code. Only Home was looked at; the other tabs were checked on web only.

Lint baseline: without the ignore list ESLint reports 24 errors and 5 warnings, all in 8 v1 files (`history`, `index`, `onboarding`, `pengeluaran`, `report`, `setup`, `tabungan`, `SplashScreenCustom`). They are 17 `react-hooks/refs` (the `useRef(new Animated.Value()).current` idiom), 3 `// text` empty states, 2 reassigned locals inside chart `.map` calls, 2 unescaped apostrophes. None is a functional bug. `eslint.config.js` ignores those 8 files until M3 deletes them; remove the ignore lines then.

Known soft spots: `test-renderer` wants React 19.3 for its reconciler while Expo pins React 19.2.3 (npm warns, tests pass; fall back to Testing Library 13 with `react-test-renderer` 19.2.3 if component tests get flaky). ESLint 9 is end of life but ESLint 10 is not supported by `eslint-plugin-import` and `eslint-plugin-react` yet. `npm audit` lists 79 advisories (1 critical), nearly all through Expo CLI, Metro and Jest tooling; not triaged.

## Spike results

### 1. On-device text recognition (ML Kit): go on paper

Compared by reading the published packages (nothing was run):

| Package | What it returns | Verdict |
|---|---|---|
| `expo-mlkit-ocr` 0.2.7 | text, blocks, lines and elements, each with a bounding box; model bundled (`com.google.mlkit:text-recognition:16.0.1`); modern `expo-module-gradle-plugin` | Usable, but it never closes the recognizer and drops confidence values |
| `expo-text-extractor` 2.0.0 | only `string[]`, one entry per block, no coordinates | Rejected: the receipt parser needs coordinates to pair item names with prices |
| `@react-native-ml-kit/text-recognition` 2.0.0 | classic bridge module, last release September 2025 | Not inspected further, not preferred |

The Kotlin in `expo-mlkit-ocr` is about 50 lines. Decision for M5: write a local Expo module (`modules/receipt-scan`) around the same ML Kit dependency that returns lines and elements with frames, exposes the confidence ML Kit provides (to be checked against 16.0.1 when the module is written) and closes the recognizer. `expo-mlkit-ocr` stays the drop-in fallback. The legacy `ExpoModulesCorePlugin.gradle` helpers still exist in `expo-modules-core` 57, so older modules do not fail on that alone. A device build is still needed to prove any of this.

### 2. Document scanner: conditional

`@infinitered/react-native-mlkit-document-scanner` 5.0.0 is Android only, uses old-style Gradle (a `buildscript` Kotlin classpath, fallback `compileSdkVersion` 34) and pulls in `@infinitered/react-native-mlkit-core`. SDK 57 builds with AGP 8.12.0 and Kotlin 2.1.20, so this is a real compatibility risk. `expo-camera` 57 has no document scanner (the docs list only a barcode scanner). In M5, choose between a local module around ML Kit `GmsDocumentScanning` and `expo-image-picker` plus a manual crop. The receipt flow must work without the scanner either way.

### 3. `expo-sqlite` on web: works, with caveats

Tested in the web preview with a throwaway page and a temporary `metro.config.js` (both removed again). 21 checks, 20 passed. What worked: opening a database, SQLite 3.50.3, `PRAGMA foreign_keys`, `PRAGMA user_version`, CHECK constraints, foreign keys, partial and unique partial indexes, `COLLATE NOCASE` unique, 13-digit and 2^40 integers coming back as JS numbers, `withTransactionAsync` rolling back on a throw with foreign keys still enforced inside it, `GROUP BY`, window functions, `json_extract`, `strftime` on epoch seconds.

Caveats to carry into M2:

- `web.output` has to be `"single"`. With `"static"`, Metro fails to bundle `expo-sqlite/web/worker.ts` ("Worker chunk not found") during the server render pass and every page returns 500.
- `metro.config.js` needs `config.resolver.assetExts.push("wasm")` and, in `config.server.enhanceMiddleware`, the headers `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` (from the Expo SQLite docs).
- In this Expo CLI the root URL `/` is served without those headers, so `crossOriginIsolated` is false and `SharedArrayBuffer` is missing. Any other path (for example `/index.html` or a deep link such as `/history`) gets them. Open the preview through such a path.
- FTS5 is not available on web (`no such module: fts5`). Search in History must use `LIKE` on lowercased columns, which is enough for personal data volumes. Native has FTS enabled, but the same code has to run on both.
- WAL is not available on web (`journal_mode` reads back `delete`). Run the pragma anyway and ignore the result.
- Error messages from web SQLite are generic ("Error finalizing statement"). Validate in code before writing and do not parse messages.
- Web support is alpha in the docs. Web stays a preview target, used by me to check screens against a real database.

### 4. Dates and time zones: avoid Hermes `Intl`

Design decision instead of a test. Each transaction stores `occurred_at` (UTC epoch ms), `occurred_offset_min` and `occurred_local_date`. To display one, shift the epoch by the stored offset and read the UTC fields, with day and month names from our own Indonesian and English tables. That needs no time zone support in Hermes `Intl`. The zone name and locale come from `expo-localization` (`getCalendars()[0].timeZone`, which can be null on web, and `getLocales()[0].languageTag`). On Android the user can change the locale without restarting the app, so refresh both when the app returns to the foreground.

### 5. `expo-blur` on Android: open

From the SDK 57 docs only. It needs a `BlurTargetView` plus a `blurTarget` ref on each `BlurView`, and `blurMethod` defaults to `'none'` (a plain translucent view). Use `dimezisBlurViewSdk31Plus` so Android 11 and older do not fall back to the slow RenderScript path. A `BlurView` rendered before dynamic content such as a `FlatList` may not update. Whether it looks and performs right needs a real Android 12+ phone.

### 6. Not measured

APK size and cold start time. Both need our own build, Expo Go says nothing about them.

## Environment findings

- What runs on the owner's side (seen on 18 November): the emulator `emulator-5554` (AVD `Pixel_5_API_30`, Android 11, x86, 1080x2340), Expo Go (`host.exp.exponent`) showing the app, and Metro on port 8081 started with `npx expo start` in the project folder. The earlier release build of v1 (`com.veingh0st.duitku`) is installed on the same emulator. Over `adb` screenshots and taps work, so screens can be checked on the real Android renderer instead of the web preview.
- No JDK on this machine, so there is no local Gradle build yet. The Android Studio program was not found in the standard places: version 2022.2 used to live in `C:\Program Files\Android\Android Studio` (empty now, config from 2023 remains) and no `studio64` process was running. The SDK has platform 34, build-tools 34.0.0, emulator 32.1.14, no `cmdline-tools`, no NDK or CMake. A local build of React Native 0.86 needs JDK 17 or newer, platform 36, build-tools 36.0.0, NDK 27.1.12297006 and CMake 3.30.5.
- Good for a local build later: WHPX is installed and usable (emulator acceleration), 15.7 GB RAM, Windows long paths are enabled.
- The emulator is Android 11, so `expo-blur` cannot show a real blur on it (needs Android 12 or newer). Checking blur needs a newer emulator image or a phone.
- Port 8081 was taken by XAMPP Apache (`httpd.exe`) earlier, which answers before Metro does. It is stopped now. If it comes back, run Metro on another port, for example `npx expo start --port 8099`.
- EAS is logged in as `veingh0st` and `eas.json` already has a `development` profile. Nothing was built.
- A hidden browser pane pauses `requestAnimationFrame`, so the JS-driven splash animation on web never finishes. Keep the pane visible when checking the web preview.

## Decision: how to test on Android

In use: Expo Go on the Android emulator, plus the web preview for quick checks. The first on-device check passed: the cleaned v1 renders correctly on the emulator with the upgraded SDK 57 packages (Home with real data, tab bar, mascot).

Later: an EAS development build when M5 first needs the local ML Kit module (cloud build, one build per native dependency change, free-tier queue and monthly limit, source goes to Expo servers), or a local toolchain (JDK 17 or newer plus platform 36, build-tools 36, NDK 27.1 and CMake 3.30.5, about 3 GB, SDK licenses accepted by the owner). Decide at M5.
