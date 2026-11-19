import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../theme";
import { useSvgId } from "../useSvgId";

export type HorizonGlowProps = {
  /** 0 to 1. How much is left this month: the more money, the brighter the horizon. */
  intensity: number;
  height?: number;
};

/**
 * One soft lime glow along the top edge of Home. It is the only glow in the app
 * (antislop R-13). Its strength is capped by the palette so text on the glass
 * hero above it keeps its contrast, and it never moves.
 */
export function HorizonGlow({ intensity, height = 380 }: HorizonGlowProps) {
  const { color } = useTheme();
  const id = useSvgId("glow");
  const alpha = Math.min(1, Math.max(0, intensity)) * color.glass.glowMax;

  return (
    <Svg
      width="100%"
      height={height}
      style={styles.glow}
      aria-hidden
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="0%" rx="80%" ry="100%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={color.accent} stopOpacity={alpha} />
          <Stop offset="0.55" stopColor={color.accent} stopOpacity={alpha * 0.3} />
          <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none" },
});
