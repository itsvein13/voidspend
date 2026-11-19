import { useId } from "react";

/** React ids look like ":r1:". The colons break SVG `url(#id)` references, so strip them. */
export function useSvgId(prefix = "g"): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}
