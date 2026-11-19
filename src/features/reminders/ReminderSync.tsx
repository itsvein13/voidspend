import { useEffect, useRef } from "react";

import { useQuery } from "@/db/DatabaseProvider";
import { getMeta } from "@/db/repo/meta";
import { listRecurringRules } from "@/db/repo/recurring";
import { useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatRupiah } from "@/lib/money";

import { applyReminders, canNotify, notificationsAllowed, type ReminderMessage } from "./notify";
import { planReminders } from "./plan";

/** The meta key set the first time a person turns a reminder on. Before that, this component touches nothing. */
export const REMINDERS_USED_KEY = "reminders_used";

/**
 * Keeps the phone's scheduled reminders equal to what the recurring rules ask for. It runs when the app opens and
 * whenever a rule changes, and does nothing when the plan is the same as the last one it applied. It renders nothing.
 */
export function ReminderSync() {
  const t = useT();
  const rules = useQuery(["reminder-rules"], (db) => listRecurringRules(db));
  const used = useQuery(["reminders-used"], async (db) => (await getMeta(db, REMINDERS_USED_KEY)) === "1");
  const last = useRef("");

  useEffect(() => {
    if (!canNotify || !rules.data || used.data === undefined) return;
    const clock = getClock();
    const planned = planReminders(rules.data, clock.now, clock.offsetMin);
    // Never asked for a reminder: leave the notification system alone, so nothing is loaded or requested.
    if (planned.length === 0 && !used.data) return;

    const messages: ReminderMessage[] = planned.map((item) => ({
      id: item.id,
      at: item.at,
      title: t.reminders.title(item.title),
      body: item.auto ? t.reminders.bodyAuto(formatRupiah(item.amount)) : t.reminders.body(formatRupiah(item.amount)),
    }));
    const signature = JSON.stringify([t.reminders.channel, messages]);
    if (signature === last.current) return;
    last.current = signature;

    void (async () => {
      try {
        // Without permission there is nothing to schedule, and anything left over from before is taken away.
        await applyReminders((await notificationsAllowed()) ? messages : [], t.reminders.channel);
      } catch (error) {
        console.warn("Could not update the reminders", error);
        last.current = "";
      }
    })();
  }, [rules.data, used.data, t]);

  return null;
}
