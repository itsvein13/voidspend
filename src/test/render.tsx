import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DesignProvider } from "@/design";

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Renders a component the way the app does: inside the design providers. */
export async function renderWithDesign(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DesignProvider>{ui}</DesignProvider>
    </SafeAreaProvider>,
  );
}
