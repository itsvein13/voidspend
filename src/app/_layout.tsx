import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DatabaseProvider } from "@/db/DatabaseProvider";
import { DesignProvider, Screen, Text, useTheme } from "@/design";
import { AppLock } from "@/features/lock/AppLock";
import { AppGate } from "@/features/shell/AppGate";
import { DOCK_SPACE } from "@/features/shell/Dock";
import { SplashGate, SplashView } from "@/features/shell/Splash";

SplashScreen.preventAutoHideAsync();

// Sheets slide up over the tabs as full-screen modals. Native form sheets (a partial height with the screen
// behind visible) did not open under Expo Go on Android 11, so they wait for a development build.
const sheet = { presentation: "modal", animation: "slide_from_bottom" } as const;

function AppStack() {
  const { color } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add" options={sheet} />
      <Stack.Screen name="transaction/[id]" options={sheet} />
      <Stack.Screen name="salary" options={sheet} />
      <Stack.Screen name="settings" options={sheet} />
      <Stack.Screen name="goal/[id]" options={sheet} />
      <Stack.Screen name="goal-edit" options={sheet} />
      <Stack.Screen name="budgets" options={sheet} />
      <Stack.Screen name="budget-edit" options={sheet} />
      <Stack.Screen name="categories" options={sheet} />
      <Stack.Screen name="recurring" options={sheet} />
      <Stack.Screen name="reset" options={sheet} />
      <Stack.Screen name="deleted" options={sheet} />
      <Stack.Screen name="wallets" options={sheet} />
      <Stack.Screen name="wallet-edit" options={sheet} />
      <Stack.Screen name="transfer" options={sheet} />
      <Stack.Screen name="tags" options={sheet} />
      <Stack.Screen name="restore" options={sheet} />
      <Stack.Screen name="scan" options={sheet} />
      <Stack.Screen name="receipt/[id]" options={sheet} />
    </Stack>
  );
}

function FatalError({ error }: { error: Error }) {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        VOIDSPEND
      </Text>
      <Text variant="body" tone="danger">{`The database could not be opened: ${error.message}`}</Text>
    </Screen>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <DesignProvider snackbarOffset={DOCK_SPACE - 16}>
          <AppLock>
            <DatabaseProvider loading={<SplashView />} renderError={(error) => <FatalError error={error} />}>
              <SplashGate>
                <AppGate>
                  <AppStack />
                </AppGate>
              </SplashGate>
            </DatabaseProvider>
          </AppLock>
        </DesignProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
