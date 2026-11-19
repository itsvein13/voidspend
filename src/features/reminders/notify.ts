// The only file that talks to the phone's notification system. Local notifications only: nothing here needs a
// server or a push token, and nothing leaves the phone.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { REMINDER_PREFIX } from "./plan";

/** Reminders exist on Android and iOS. The web preview has none. */
export const canNotify = Platform.OS === "android" || Platform.OS === "ios";

export const CHANNEL_ID = "recurring";

let handlerInstalled = false;

/** Lets a reminder show while the app is open too. Called once. */
export function installNotificationHandler(): void {
  if (!canNotify || handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!canNotify) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Asks the system once. On Android 13 and newer this shows the system prompt. Older versions allow it already. */
export async function askForNotifications(): Promise<boolean> {
  if (!canNotify) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export type ReminderMessage = { id: string; at: number; title: string; body: string };

/**
 * Makes the scheduled reminders exactly `messages`: the ones of this app that are no longer wanted are cancelled,
 * the others are scheduled again under the same id, so running it twice never doubles a reminder.
 */
export async function applyReminders(messages: readonly ReminderMessage[], channelName: string): Promise<void> {
  if (!canNotify) return;
  installNotificationHandler();
  // The channel is what the person sees in the phone's settings. If it cannot be made (Expo Go cannot), the
  // reminders are still scheduled and use the default channel, rather than none at all.
  let channelReady = false;
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: channelName, importance: Notifications.AndroidImportance.DEFAULT });
      channelReady = true;
    } catch (error) {
      console.warn("Could not create the reminder channel", error);
    }
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((item) => item.identifier.startsWith(REMINDER_PREFIX)).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  for (const message of messages) {
    await Notifications.scheduleNotificationAsync({
      identifier: message.id,
      content: { title: message.title, body: message.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(message.at),
        ...(channelReady ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}
