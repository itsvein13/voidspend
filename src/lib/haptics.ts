// Haptic feedback behind one switch. The preference lives in PrefsProvider,
// which calls setHapticsEnabled; call sites just say what happened.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

function run(play: () => Promise<void>): void {
  if (!enabled || Platform.OS === "web") return;
  play().catch(() => {
    // A device without a vibration motor is not an error worth surfacing.
  });
}

export const haptic = {
  /** A primary action was pressed. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A choice moved, as in a segmented control. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Something was saved. */
  success: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A limit was crossed. */
  warning: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
