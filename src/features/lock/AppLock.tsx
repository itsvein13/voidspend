import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";

import { Button, Text, useTheme } from "@/design";
import { useT } from "@/i18n";
import { usePrefs } from "@/lib/PrefsProvider";

import { authenticate, shouldRelock } from "./lock";

/**
 * Covers the app with a lock screen when the person turned the lock on: at start,
 * and after the app has been in the background for a minute. The app underneath
 * stays mounted, so an unfinished entry is still there after unlocking, and it is
 * hidden from screen readers while the cover is up.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const { prefs, loaded } = usePrefs();
  const [locked, setLocked] = useState(true);
  const [seen, setSeen] = useState<boolean | null>(null);
  const awayAt = useRef<number | null>(null);

  // The first value after preferences load decides the lock at start. A change after that comes from the
  // settings switch, which already asked the person to verify, so the app must not lock them out mid-way.
  if (loaded && seen === null) {
    setSeen(prefs.appLock);
  } else if (loaded && seen !== prefs.appLock) {
    setSeen(prefs.appLock);
    setLocked(false);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        awayAt.current = Date.now();
      } else if (state === "active") {
        if (shouldRelock(awayAt.current, Date.now())) setLocked(true);
        awayAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const waiting = !loaded;
  const covered = locked && (waiting || prefs.appLock);
  return (
    <View style={styles.root}>
      <View style={styles.root} importantForAccessibility={covered ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={covered}>
        {children}
      </View>
      {covered ? <LockScreen waiting={waiting} onUnlocked={() => setLocked(false)} /> : null}
    </View>
  );
}

function LockScreen({ waiting, onUnlocked }: { waiting: boolean; onUnlocked: () => void }) {
  const t = useT();
  const { color } = useTheme();
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const ok = await authenticate(t.lock.prompt, t.common.cancel);
    asking.current = false;
    if (ok) onUnlocked();
    else setFailed(true);
  }, [t, onUnlocked]);

  // Ask as soon as the lock is really on, which is once preferences are known.
  useEffect(() => {
    // State is set only after the system prompt answers, never while the effect runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!waiting) void ask();
  }, [waiting, ask]);

  const retry = () => {
    setFailed(false);
    void ask();
  };

  // While preferences load the cover is only the canvas, so nothing flashes on a phone with the lock off.
  if (waiting) return <View style={[styles.cover, { backgroundColor: color.canvas }]} />;

  return (
    <View style={[styles.cover, { backgroundColor: color.canvas }]} accessibilityViewIsModal>
      <Text variant="title" accessibilityRole="header" style={styles.center}>
        {t.lock.lockedTitle}
      </Text>
      {failed ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite" style={styles.center}>
          {t.lock.failed}
        </Text>
      ) : null}
      <Button label={t.lock.unlock} icon="lock-open-outline" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 24, padding: 32 },
  center: { textAlign: "center" },
});
