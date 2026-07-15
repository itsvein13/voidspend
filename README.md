# VOIDSPEND

_track the drain._

A minimalist personal finance tracker built for people who want a fast, no-nonsense way to see where their salary goes each month — without setting up an account, connecting a bank, or trusting a server with their financial data.

![Platform](https://img.shields.io/badge/platform-Android-3DDC84)
![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020)
![Language](https://img.shields.io/badge/language-TypeScript-3178C6)

---

## About

VOIDSPEND is a mobile finance app built around one idea: track your monthly salary, log what you spend and save, and always know exactly how much is left — all stored locally on your device, no login required.

The app pairs a dark, editorial visual identity with a custom illustrated mascot that reacts to your spending habits, turning a routine budgeting task into something a little more alive.

## Features

- **Onboarding flow** — first-time setup with username and monthly salary
- **Home dashboard** — real-time balance, income/expense/savings breakdown, and a live mini chart
- **Reactive mascot** — expression changes based on how much of your salary is left
- **Expense & savings tracking** — categorized entries with custom names and amounts
- **Savings targets** — set a goal per savings item and track progress visually
- **Budget limits** — monthly cap per expense category, with over-budget warnings
- **Monthly history** — filterable transaction log with month navigation
- **Reports** — category breakdowns via donut charts, plus a shareable monthly summary
- **Dark / light theme** — full toggle, persisted across sessions
- **Offline-first** — all data stored locally with AsyncStorage; nothing leaves the device

## Tech Stack

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/) — file-based navigation
- TypeScript
- [react-native-svg](https://github.com/software-mansion/react-native-svg) — custom charts, no chart library dependency
- `@react-native-async-storage/async-storage` — local persistence
- Space Grotesk (via `@expo-google-fonts`)

## Screens

| Screen     | Description                                       |
| ---------- | ------------------------------------------------- |
| Splash     | Animated logo intro with a glitch-text credit     |
| Onboarding | 3-slide intro to the app's core value props       |
| Setup      | Username + monthly salary entry                   |
| Home       | Dashboard with balance, quick actions, and mascot |
| Expense    | Add / edit / delete categorized expenses          |
| Savings    | Add / edit / delete savings with optional targets |
| History    | Full transaction log with filtering               |
| Report     | Charts, budget tracker, and shareable summary     |
| Profile    | Account settings, theme toggle, data reset        |

## Screenshots

<!-- Add screenshots here — Home, Expense modal, Report, Profile -->

## Getting Started

```bash
git clone https://github.com/itsvein13/voidspend.git
cd voidspend
npm install
npx expo start
```

Requires Node.js 20+ and Expo Go (or an Android/iOS emulator) to run in development.

## Design

VOIDSPEND's visual identity is built around a dark, minimal palette with a single lime-green accent, paired with an original mascot character designed for the app. Every screen follows the same restrained, editorial tone.

## Author

Built by **Rizki** — [@veingh0st](https://instagram.com/veingh0st)

---

_VOIDSPEND is a personal project built to explore product design and mobile development end-to-end — from UI concept to a working Expo build._
