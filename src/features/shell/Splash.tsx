import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Text, useReduceMotion, useTheme } from "@/design";

const SEEN_KEY = "v2.splashSeen";
const FIRST_LAUNCH_MS = 2200;
const RETURNING_MS = 800;

/** The logo on the canvas. Used while the database opens, and by the gate below. */
export function SplashView({ showCredit = false, onSkip }: { showCredit?: boolean; onSkip?: () => void }) {
  const { color } = useTheme();
  const reduce = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="VOIDSPEND"
      accessibilityHint={onSkip ? "Tap to continue" : undefined}
      disabled={!onSkip}
      onPress={onSkip}
      style={[styles.root, { backgroundColor: color.canvas }]}
    >
      <Animated.View entering={reduce ? undefined : FadeIn.duration(320)} style={styles.center}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="VOIDSPEND" />
        <Text variant="body" tone="secondary">
          track the drain.
        </Text>
      </Animated.View>
      {showCredit ? (
        <Text variant="caption" tone="secondary" style={styles.credit}>
          created by veingh0st
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Shows the splash for a short time, then the app. The first launch gets the
 * longer version with the credit, later launches about 0.8 seconds. A tap skips
 * it, and reduced motion drops the fade.
 */
export function SplashGate({ children }: { children: ReactNode }) {
  const [firstLaunch, setFirstLaunch] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let seen: string | null = null;
      try {
        seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen === null) await AsyncStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage can fail in odd environments. Treat it as a returning launch.
        seen = "1";
      }
      if (alive) setFirstLaunch(seen === null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (firstLaunch === null) return;
    const timer = setTimeout(() => setDone(true), firstLaunch ? FIRST_LAUNCH_MS : RETURNING_MS);
    return () => clearTimeout(timer);
  }, [firstLaunch]);

  if (!done) return <SplashView showCredit={firstLaunch === true} onSkip={firstLaunch === null ? undefined : () => setDone(true)} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: 12 },
  logo: { width: 220, height: 96 },
  credit: { position: "absolute", bottom: 48 },
});
