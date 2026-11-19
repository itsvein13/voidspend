import { Tabs } from "expo-router";

import { useBreakpoint } from "@/design";
import { Dock, Rail, type DockProps } from "@/features/shell/Dock";

export default function TabsLayout() {
  // A wide window gets a rail on the left, a phone gets the floating dock.
  const { widthClass } = useBreakpoint();
  const wide = widthClass === "expanded";
  return (
    <Tabs
      tabBar={(props) => (wide ? <Rail {...(props as unknown as DockProps)} /> : <Dock {...(props as unknown as DockProps)} />)}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="insights" />
    </Tabs>
  );
}
