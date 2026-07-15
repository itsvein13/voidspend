/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const colors = {
  bg: "#000000",
  surface: "#0d0d0d",
  surface2: "#1a1a1a",
  border: "#2a2a2a",
  accent: "#c8f542",
  danger: "#ff3b3b",
  saving: "#3b82f6",
  text: "#ffffff",
  muted: "#555555",
  subtext: "#888888",
};

export const font = {
  black: "SpaceGrotesk_700Bold",
  bold: "SpaceGrotesk_600SemiBold",
  regular: "SpaceGrotesk_400Regular",
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
