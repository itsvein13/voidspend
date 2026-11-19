// The phone's own screen lock (fingerprint, PIN or pattern) through expo-local-authentication.
// The app stores no secret of its own. Every call answers with a plain value and never throws.
import * as LocalAuthentication from "expo-local-authentication";

/** True when the phone has a screen lock the app can ask for. */
export async function canUseLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Asks the person to prove it is them. False when they cancel, fail, or the phone cannot ask. */
export async function authenticate(promptMessage: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}

/** How long the app can stay in the background before it locks again. A camera or a file picker stays inside this. */
export const LOCK_GRACE_MS = 60_000;

/** The lock rule on its own, so it is tested without a phone. */
export function shouldRelock(awayAt: number | null, now: number, graceMs: number = LOCK_GRACE_MS): boolean {
  return awayAt !== null && now - awayAt >= graceMs;
}
