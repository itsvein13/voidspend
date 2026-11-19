import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { layout } from "../tokens";
import { useBreakpoint } from "./breakpoint";

export type ScreenProps = {
  children: ReactNode;
  /** Scrolls the content. Turn it off for a screen that fits, such as a sheet. */
  scroll?: boolean;
  /** Painted behind the content, for the horizon glow. */
  background?: ReactNode;
  /** Extra room at the bottom, for a floating dock. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * The canvas of a screen: safe areas, gutters that grow with the window, and a
 * centered column that stops at 640 dp so lists stay readable on a tablet.
 */
export function Screen({ children, scroll = true, background, bottomInset = 0, contentStyle }: ScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useBreakpoint();

  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 24 + bottomInset,
    paddingHorizontal: gutter,
  };

  return (
    <View style={[styles.root, { backgroundColor: color.canvas }]}>
      {background}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.column, padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.column, padding, styles.fill, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  fill: { flex: 1 },
});
