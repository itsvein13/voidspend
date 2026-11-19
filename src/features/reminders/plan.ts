// Which reminders to put on the phone for the recurring rules that ask for one. Pure: a list of rules in, a list
// of moments out, so the dates, the end date, a paused rule and the horizon are all covered by unit tests.
import { scheduleOf, type RecurringRule } from "@/db/repo/recurring";
import { epochFromLocal, type LocalDate } from "@/lib/dates";
import { stepOccurrence } from "@/lib/recurrence";

/** Every reminder goes off at nine in the morning of the day an item is due, in the phone's zone. */
export const REMINDER_HOUR = 9;
/** How many coming occurrences of one rule get a reminder, so a missed one is followed by the next. */
export const REMINDER_HORIZON = 6;
/** All the reminders of this app start with this, so they can be told apart from any other scheduled notification. */
export const REMINDER_PREFIX = "voidspend-rule-";

export type PlannedReminder = {
  id: string;
  /** The moment it goes off, in epoch milliseconds. */
  at: number;
  date: LocalDate;
  ruleId: string;
  title: string;
  amount: number;
  /** An automatic rule records itself when the app opens, so its text does not ask for a tap. */
  auto: boolean;
};

/**
 * The reminders still to come for every rule that has one switched on. A rule that is paused has none. A due date
 * that has already passed has none, because Home already offers it. The end date of a rule is respected.
 */
export function planReminders(rules: readonly RecurringRule[], nowMs: number, offsetMin: number, horizon: number = REMINDER_HORIZON): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const rule of rules) {
    if (!rule.remind || rule.pausedAt !== null) continue;
    const schedule = scheduleOf(rule);
    let date = rule.nextDueDate;
    let found = 0;
    // The guard stops a rule whose next dates are all in the past from walking forever.
    for (let guard = 0; guard < 400 && found < horizon; guard++) {
      if (rule.endDate !== null && date > rule.endDate) break;
      const at = epochFromLocal(date, REMINDER_HOUR, 0, offsetMin);
      if (at > nowMs) {
        planned.push({ id: `${REMINDER_PREFIX}${rule.id}-${date}`, at, date, ruleId: rule.id, title: rule.title, amount: rule.amount, auto: rule.mode === "auto" });
        found++;
      }
      date = stepOccurrence(schedule, date);
    }
  }
  return planned.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
