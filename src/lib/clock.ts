import { currentOffsetMinutes, localDateOf, type LocalDate } from "./dates";
import { deviceTimeZone } from "./device";

export type Clock = { now: number; offsetMin: number; tz: string; today: LocalDate };

/** The moment, the phone's UTC offset and zone, and today's date in that zone. Read it when you need it, never cache it. */
export function getClock(now: number = Date.now()): Clock {
  const offsetMin = currentOffsetMinutes(new Date(now));
  return { now, offsetMin, tz: deviceTimeZone() ?? "UTC", today: localDateOf(now, offsetMin) };
}
