import type { ReactNode } from "react";

import { I18nProvider } from "@/i18n";
import { PrefsProvider } from "@/lib/PrefsProvider";

import { SnackbarProvider } from "./primitives/Snackbar";
import { ThemeProvider } from "./theme";

/**
 * Mount once near the root, inside SafeAreaProvider. Order matters:
 * preferences feed the theme and the language, and snackbars need both.
 *
 * Reduced motion is not configured here through Reanimated's global switch,
 * which logs a warning on every mount. Each component asks useReduceMotion(),
 * which already combines the system setting with the in-app switch.
 */
export function DesignProvider({ children, snackbarOffset = 0 }: { children: ReactNode; snackbarOffset?: number }) {
  return (
    <PrefsProvider>
      <ThemeProvider>
        <I18nProvider>
          <SnackbarProvider bottomOffset={snackbarOffset}>{children}</SnackbarProvider>
        </I18nProvider>
      </ThemeProvider>
    </PrefsProvider>
  );
}
