import { useWindowDimensions } from "react-native";

import { breakpoints, layout, type WidthClass } from "../tokens";

/** Phone, large phone or small tablet, tablet landscape or desktop window. */
export function widthClass(width: number): WidthClass {
  if (width >= breakpoints.expanded) return "expanded";
  if (width >= breakpoints.medium) return "medium";
  return "compact";
}

export function gutterFor(width: number): number {
  return layout.gutter[widthClass(width)];
}

/** From this system font scale up, rows of three amounts no longer fit side by side and stack instead. */
export const LARGE_TEXT_SCALE = 1.15;

export function useBreakpoint(): { width: number; widthClass: WidthClass; gutter: number; largeText: boolean } {
  const { width, fontScale } = useWindowDimensions();
  return { width, widthClass: widthClass(width), gutter: gutterFor(width), largeText: fontScale >= LARGE_TEXT_SCALE };
}
