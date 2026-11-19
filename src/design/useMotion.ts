import { useReducedMotion } from "react-native-reanimated";

import { usePrefs } from "@/lib/PrefsProvider";
import { resolveReducedMotion } from "@/lib/prefs";

/**
 * True when motion should be reduced: the system asks for it or the in-app
 * switch is on. Components skip scale, slide and roll effects when this is
 * true and change state instantly instead.
 */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const { prefs } = usePrefs();
  return resolveReducedMotion(prefs.reduceMotion, system);
}
