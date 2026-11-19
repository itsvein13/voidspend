// VOIDSPEND design tokens. Every decision carries its reason in a comment
// (antislop R-31). Contrast between these values is proven in tokens.test.ts,
// so changing a hex here fails a test instead of failing a user.
import { withAlpha } from "./color";

export type Scheme = "dark" | "light";

export type CategoryKey =
  | "food"
  | "transport"
  | "entertainment"
  | "health"
  | "shopping"
  | "bills"
  | "other";

/**
 * Fixed display order of the category colors. The order is the color-blind
 * safety mechanism (validated with the dataviz validator in both modes), so
 * charts draw categories in this order, never sorted by amount.
 */
export const categoryOrder: readonly CategoryKey[] = [
  "food",
  "transport",
  "entertainment",
  "health",
  "shopping",
  "bills",
  "other",
];

export type Hue = "accent" | "savings" | "danger" | "warning";

export type Palette = {
  scheme: Scheme;
  // Surfaces, back to front.
  canvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  // Ink.
  text: string;
  textSecondary: string;
  textTertiary: string;
  // Lines.
  outline: string; // control boundaries, at least 3:1
  hairline: string; // decorative dividers only
  edge: string; // glass edge highlight
  focus: string;
  scrim: string;
  track: string; // the empty part of rings and bars
  // Hues. Fill is the brand value, on* is text on the fill, *Ink is the same
  // hue as text or strokes on any surface (at least 4.5:1).
  accent: string;
  onAccent: string;
  accentInk: string;
  savings: string;
  onSavings: string;
  savingsInk: string;
  danger: string;
  onDanger: string;
  dangerInk: string;
  warning: string;
  onWarning: string;
  warningInk: string;
  // Translucent hue fills for banners and chips, as alphas over a surface.
  tintAlpha: Record<Hue, number>;
  // Pressed and hovered feedback overlays.
  hover: string;
  press: string;
  // Glass is a translucent fill; glowMax caps the horizon glow behind it so
  // text on top keeps its contrast.
  glass: { tint: string; alpha: number; glowMax: number };
  category: Record<CategoryKey, string>;
  statusBar: "light" | "dark";
};

// Dark: near-black with a faint green cast. Pure black flattens depth and
// fights the lime; this lets surfaces step up in four readable tiers.
export const darkPalette: Palette = {
  scheme: "dark",
  canvas: "#050605",
  surface1: "#0E100F",
  surface2: "#161917",
  surface3: "#1F2320",
  text: "#F4F6F2",
  textSecondary: "#A3A9A0",
  textTertiary: "#868D83",
  outline: "#6A7266",
  hairline: "rgba(255, 255, 255, 0.08)",
  edge: "rgba(255, 255, 255, 0.14)",
  focus: "#C8F542",
  scrim: "rgba(0, 0, 0, 0.62)",
  track: "rgba(255, 255, 255, 0.10)",
  // Brand lime from v1. Near-black text on it, white fails AA.
  accent: "#C8F542",
  onAccent: "#0B0F02",
  accentInk: "#C8F542",
  // Brand savings blue from v1. Its ink is lifted slightly so small blue text
  // still reads on the lightest dark surface.
  savings: "#3B82F6",
  onSavings: "#060A14",
  savingsInk: "#5B97F8",
  // Brand red from v1, kept for problems only. Its ink is a touch lighter so
  // red text still clears 4.5:1 on its own tint.
  danger: "#FF3B3B",
  onDanger: "#140404",
  dangerInk: "#FF5757",
  // Amber already used for "near the limit" in v1.
  warning: "#FFD93D",
  onWarning: "#141000",
  warningInk: "#FFD93D",
  tintAlpha: { accent: 0.12, savings: 0.16, danger: 0.14, warning: 0.14 },
  hover: "rgba(255, 255, 255, 0.08)",
  press: "rgba(255, 255, 255, 0.14)",
  glass: { tint: "#FFFFFF", alpha: 0.06, glowMax: 0.16 },
  category: {
    food: "#D95926",
    transport: "#9085E9",
    entertainment: "#199E70",
    health: "#3987E5",
    shopping: "#0CA30C",
    bills: "#D55181",
    other: "#868E96",
  },
  statusBar: "light",
};

// Light ("frosted paper"): warm off-white canvas, white cards. The brand light
// green from v1 stays the fill; a darker ink of it carries text and strokes.
export const lightPalette: Palette = {
  scheme: "light",
  canvas: "#F3F5F0",
  surface1: "#FFFFFF",
  surface2: "#ECEFE8",
  surface3: "#E1E5DB",
  text: "#0B0D0B",
  textSecondary: "#4A5048",
  textTertiary: "#5F665C",
  outline: "#7A8175",
  hairline: "rgba(11, 13, 11, 0.08)",
  edge: "rgba(11, 13, 11, 0.10)",
  focus: "#2B5A00",
  scrim: "rgba(10, 14, 8, 0.48)",
  track: "rgba(11, 13, 11, 0.10)",
  accent: "#5A9E0F",
  onAccent: "#0B0F02",
  accentInk: "#386F00",
  savings: "#1D60CC",
  onSavings: "#FFFFFF",
  savingsInk: "#1A56B8",
  danger: "#E02020",
  onDanger: "#FFFFFF",
  dangerInk: "#B31414",
  // Amber is too light to stand on white alone: banners use a tint plus a
  // border in warningInk.
  warning: "#FFD93D",
  onWarning: "#141000",
  warningInk: "#7A5800",
  tintAlpha: { accent: 0.12, savings: 0.1, danger: 0.1, warning: 0.3 },
  hover: "rgba(11, 13, 11, 0.06)",
  press: "rgba(11, 13, 11, 0.12)",
  glass: { tint: "#FFFFFF", alpha: 0.62, glowMax: 0.14 },
  category: {
    food: "#EB6834",
    transport: "#6250D6",
    entertainment: "#1BAF7A",
    health: "#2A78D6",
    shopping: "#008300",
    bills: "#E87BA4",
    other: "#6B7280",
  },
  statusBar: "dark",
};

export const palettes: Record<Scheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

/** Translucent fill of a hue, for banners and chips. */
export function tint(palette: Palette, hue: Hue): string {
  return withAlpha(palette[hue], palette.tintAlpha[hue]);
}

// Type. Space Grotesk is the v1 brand face and carries display text and money.
// Plus Jakarta Sans carries reading text: drawn for Jakarta, clear at 12 to
// 15 sp, and not the default pick of generated UIs.
export const fonts = {
  displayBold: "SpaceGrotesk_700Bold",
  displaySemi: "SpaceGrotesk_600SemiBold",
  textRegular: "PlusJakartaSans_400Regular",
  textMedium: "PlusJakartaSans_500Medium",
  textSemi: "PlusJakartaSans_600SemiBold",
  textBold: "PlusJakartaSans_700Bold",
} as const;

export type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "bodyLg"
  | "body"
  | "button"
  | "label"
  | "caption"
  | "micro"
  | "amountLg"
  | "amountMd"
  | "amountSm";

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  tabular?: boolean;
  // Caps how far the system font scale can grow this style.
  maxFontScale: number;
};

// Sentence case everywhere. No tracked all-caps labels.
export const typography: Record<TextVariant, TypeStyle> = {
  display: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 48, letterSpacing: -0.8, maxFontScale: 1.3 },
  title: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5, maxFontScale: 1.4 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, maxFontScale: 1.5 },
  subheading: { fontFamily: fonts.textSemi, fontSize: 20, lineHeight: 26, letterSpacing: -0.1, maxFontScale: 1.6 },
  bodyLg: { fontFamily: fonts.textMedium, fontSize: 17, lineHeight: 24, letterSpacing: 0, maxFontScale: 1.8 },
  body: { fontFamily: fonts.textRegular, fontSize: 15, lineHeight: 22, letterSpacing: 0, maxFontScale: 2 },
  button: { fontFamily: fonts.textSemi, fontSize: 15, lineHeight: 20, letterSpacing: 0.1, maxFontScale: 1.6 },
  label: { fontFamily: fonts.textSemi, fontSize: 13, lineHeight: 18, letterSpacing: 0.1, maxFontScale: 2 },
  caption: { fontFamily: fonts.textMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1, maxFontScale: 2 },
  micro: { fontFamily: fonts.textMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.2, maxFontScale: 2 },
  amountLg: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 48, letterSpacing: -0.8, tabular: true, maxFontScale: 1.3 },
  amountMd: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, tabular: true, maxFontScale: 1.5 },
  amountSm: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 22, letterSpacing: 0, tabular: true, maxFontScale: 1.8 },
};

// Spacing on a 4 point grid.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56 } as const;

// Radius by role, not by size, so a card never ends up pill-shaped by accident.
// Only the avatar and the add button are fully round.
export const radius = {
  field: 10,
  button: 16,
  card: 22,
  hero: 30,
  sheet: 30,
  full: 999,
} as const;

// Android and web guidance for the smallest comfortable touch target.
export const minTarget = 44;

export const motion = {
  duration: { fast: 120, base: 200, slow: 320 },
  spring: {
    snappy: { damping: 18, stiffness: 320, mass: 1 },
    gentle: { damping: 22, stiffness: 150, mass: 1 },
  },
  // Cubic bezier control points: quick start, long settle.
  easing: [0.2, 0, 0, 1],
} as const;

// Width classes, in dp. Compact is a phone, medium a large phone or small
// tablet, expanded a tablet in landscape or a desktop window.
export const breakpoints = { medium: 600, expanded: 840 } as const;
export type WidthClass = "compact" | "medium" | "expanded";

export const layout = {
  gutter: { compact: 20, medium: 24, expanded: 32 },
  maxContentWidth: 640,
} as const;

/**
 * Elevation exists to mark what floats: the hero, the dock and snackbar, and
 * sheets. Everything else sits flat on the canvas.
 */
export function elevation(scheme: Scheme) {
  const dark = scheme === "dark";
  return {
    hero: dark
      ? "0 16px 40px rgba(0, 0, 0, 0.45)"
      : "0 12px 32px rgba(24, 36, 12, 0.12)",
    floating: dark
      ? "0 10px 28px rgba(0, 0, 0, 0.6)"
      : "0 8px 24px rgba(24, 36, 12, 0.16)",
    sheet: dark
      ? "0 -8px 32px rgba(0, 0, 0, 0.6)"
      : "0 -6px 28px rgba(24, 36, 12, 0.14)",
  } as const;
}
