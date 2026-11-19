import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, PressableScale, Surface, Text, useBreakpoint, useTheme, withAlpha, type IconName } from "@/design";
import { useT } from "@/i18n";

/** Room a screen leaves at the bottom so the dock never covers the last row. */
export const DOCK_SPACE = 96;

const TABS: Record<string, { icon: IconName; iconActive: IconName; label: "home" | "history" | "goals" | "insights" }> = {
  index: { icon: "home-outline", iconActive: "home", label: "home" },
  history: { icon: "time-outline", iconActive: "time", label: "history" },
  goals: { icon: "flag-outline", iconActive: "flag", label: "goals" },
  insights: { icon: "stats-chart-outline", iconActive: "stats-chart", label: "insights" },
};

/** The part of the tab bar props the dock uses. expo-router and @react-navigation type the full props differently, so only this slice is declared. */
export type DockProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  navigation: {
    emit(event: { type: "tabPress"; target: string; canPreventDefault: boolean }): { defaultPrevented: boolean };
    navigate(name: string, params?: object): void;
  };
};

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * The floating dock: Home and History on either side of the add button. It
 * floats, so it is the one place besides the hero that carries a shadow. The
 * ring around the add button is the void ring motif.
 */
export function Dock({ state, navigation }: DockProps) {
  const { color } = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter } = useBreakpoint();
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  const items = state.routes.filter((route) => TABS[route.name]);
  const renderTab = (route: (typeof items)[number]) => {
    const tab = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    const label = t.nav[tab.label];
    return (
      <PressableScale
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={label}
        selected={focused}
        haptic="select"
        scaleTo={0.94}
        cornerRadius={22}
        containerStyle={styles.tabCell}
        style={styles.tab}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
      >
        <Icon name={focused ? tab.iconActive : tab.icon} size={24} color={focused ? color.accentInk : color.textSecondary} />
        <Text variant="micro" tone={focused ? "accent" : "secondary"}>
          {label}
        </Text>
      </PressableScale>
    );
  };

  const left = items.slice(0, 2);
  const right = items.slice(2);
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 8, paddingHorizontal: gutter }]}>
      <Surface variant="raised" radius="hero" elevated style={styles.dock}>
        {left.map(renderTab)}
        <View style={styles.addSlot}>
          <PressableScale
            accessibilityLabel={t.nav.add}
            haptic="tap"
            scaleTo={0.92}
            cornerRadius={32}
            onPress={() => router.push("/add")}
            style={[styles.addRing, { borderColor: withAlpha(color.accent, 0.4) }]}
          >
            <View style={[styles.add, { backgroundColor: color.accent }]}>
              <Icon name="add" size={28} color={color.onAccent} />
            </View>
          </PressableScale>
        </View>
        {right.map(renderTab)}
      </Surface>
    </View>
  );
}

/**
 * On a wide window (840 dp and up, such as a tablet in landscape or a desktop
 * browser) the dock becomes a rail down the left edge: the add button on top and
 * the four places below it. It sits in the layout instead of floating over it,
 * so no screen needs to leave room at the bottom.
 */
export function Rail({ state, navigation }: DockProps) {
  const { color } = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = state.routes.filter((route) => TABS[route.name]);

  return (
    <View style={[styles.rail, { backgroundColor: color.surface1, borderRightColor: color.outline, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <PressableScale accessibilityLabel={t.nav.add} haptic="tap" scaleTo={0.92} cornerRadius={32} onPress={() => router.push("/add")} style={[styles.addRing, { borderColor: withAlpha(color.accent, 0.4) }]}>
        <View style={[styles.add, { backgroundColor: color.accent }]}>
          <Icon name="add" size={28} color={color.onAccent} />
        </View>
      </PressableScale>
      <View style={styles.railTabs} accessibilityRole="tablist">
        {items.map((route) => {
          const tab = TABS[route.name];
          const focused = state.routes[state.index]?.key === route.key;
          const label = t.nav[tab.label];
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              selected={focused}
              haptic="select"
              scaleTo={0.94}
              cornerRadius={18}
              containerStyle={styles.railCell}
              style={[styles.tab, focused && { backgroundColor: withAlpha(color.accent, 0.12) }]}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
            >
              <Icon name={focused ? tab.iconActive : tab.icon} size={24} color={focused ? color.accentInk : color.textSecondary} />
              <Text variant="micro" tone={focused ? "accent" : "secondary"}>
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 96, alignItems: "center", gap: 24, paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth },
  railTabs: { alignSelf: "stretch", gap: 8 },
  railCell: { alignSelf: "stretch" },
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "box-none" },
  dock: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", maxWidth: 480, paddingHorizontal: 12, paddingVertical: 8 },
  tabCell: { flex: 1 },
  tab: { minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2 },
  addSlot: { width: 76, alignItems: "center", justifyContent: "center" },
  addRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  add: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
