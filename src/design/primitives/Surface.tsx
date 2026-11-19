import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { withAlpha } from "../color";
import { useTheme } from "../theme";
import { radius as radii } from "../tokens";
import { useSvgId } from "../useSvgId";

// smoke: the default card. raised: one step up, for things sitting on a card.
// inset: a well, for inputs and keypad wells. glass: translucent, used on the
// hero only (antislop R-10: glass is an accent, not the whole UI).
export type SurfaceVariant = "smoke" | "raised" | "inset" | "glass";

export type SurfaceProps = ViewProps & {
  variant?: SurfaceVariant;
  radius?: keyof typeof radii | number;
  padding?: number;
  /** Lifts the surface with the hero shadow. Reserve it for what floats. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Surface({
  variant = "smoke",
  radius = "card",
  padding,
  elevated = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { color, scheme, elevation } = useTheme();
  const gradientId = useSvgId("sheen");
  const cornerRadius = typeof radius === "number" ? radius : radii[radius];

  let backgroundColor: string;
  let borderColor: string;
  switch (variant) {
    case "smoke":
      backgroundColor = color.surface1;
      borderColor = color.hairline;
      break;
    case "raised":
      backgroundColor = color.surface2;
      borderColor = color.hairline;
      break;
    case "inset":
      backgroundColor = scheme === "dark" ? color.canvas : color.surface2;
      borderColor = color.hairline;
      break;
    case "glass":
      backgroundColor = withAlpha(color.glass.tint, color.glass.alpha);
      borderColor = color.edge;
      break;
  }

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderRadius: cornerRadius,
          padding,
          boxShadow: elevated ? elevation.hero : undefined,
        },
        style,
      ]}
    >
      {variant === "glass" ? (
        // A soft light from the top edge. It is what makes the surface read as
        // glass instead of a grey card.
        <Svg
          style={[StyleSheet.absoluteFill, styles.passThrough]}
          aria-hidden
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={scheme === "dark" ? 0.1 : 0.55} />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth * 2, overflow: "hidden" },
  passThrough: { pointerEvents: "none" },
});
