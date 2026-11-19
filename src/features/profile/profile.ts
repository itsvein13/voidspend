import { getMeta, setMeta } from "@/db/repo/meta";
import {
  createRecurringRule,
  type NewRecurringRule,
} from "@/db/repo/recurring";
import { createTransaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { ValidationError, type Db } from "@/db/types";
import {
  addMonths,
  epochFromLocal,
  monthOf,
  monthStart,
  type LocalDate,
} from "@/lib/dates";

const NAME_KEY = "username";
const ONBOARDED_KEY = "onboarded";
export const LEGACY_PROFILE_KEY = "legacy_profile";

export async function getUsername(db: Db): Promise<string | null> {
  return getMeta(db, NAME_KEY);
}

export async function setUsername(db: Db, name: string): Promise<void> {
  await setMeta(db, NAME_KEY, name.trim().slice(0, 40));
}

export async function isOnboarded(db: Db): Promise<boolean> {
  return (await getMeta(db, ONBOARDED_KEY)) === "1";
}

export async function setOnboarded(db: Db): Promise<void> {
  await setMeta(db, ONBOARDED_KEY, "1");
}

/**
 * Carries the two things v1 kept next to the money, the name and the "already
 * saw the welcome" flag, so someone who updates is not welcomed again. Runs
 * once: it only acts while v2 has no answer of its own. Reads, never changes, v1.
 */
export async function migrateLegacyProfile(
  db: Db,
  storage: { getItem(key: string): Promise<string | null> },
): Promise<void> {
  // Once is enough: after a reset the old v1 name and flag must not come back.
  if (
    (await getMeta(db, LEGACY_PROFILE_KEY)) === "done" ||
    (await getMeta(db, ONBOARDED_KEY)) !== null
  )
    return;
  const [name, onboarded] = await Promise.all([
    storage.getItem("username"),
    storage.getItem("hasOnboarded"),
  ]);
  if (name && name.trim() !== "" && (await getMeta(db, NAME_KEY)) === null)
    await setUsername(db, name);
  if (onboarded === "true") await setOnboarded(db);
  await setMeta(db, LEGACY_PROFILE_KEY, "done");
}

export type SalarySetup = {
  amount: number;
  /** Day of the month the salary arrives, 1 to 31. */
  payday: number;
  /** Already in the account this month, so it is recorded now and the rule starts next month. */
  receivedThisMonth: boolean;
  /** The wallet the salary goes into. The main wallet when left out. */
  walletId?: string;
};

export function validateSalarySetup(input: SalarySetup): void {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new ValidationError(
      "amount_invalid",
      "The salary must be above zero.",
    );
  if (!Number.isInteger(input.payday) || input.payday < 1 || input.payday > 31)
    throw new ValidationError(
      "payday_invalid",
      "The payday must be between 1 and 31.",
    );
}

/** What setting up a salary means in rows: one recurring rule, and this month's income when it already arrived. */
export function planSalarySetup(
  input: SalarySetup,
  today: LocalDate,
): { rule: NewRecurringRule; recordNow: boolean } {
  validateSalarySetup(input);
  const month = monthOf(today);
  return {
    recordNow: input.receivedThisMonth,
    rule: {
      type: "income",
      amount: input.amount,
      title: "Salary",
      categoryId: systemCategoryId("salary"),
      walletId: input.walletId,
      frequency: "monthly",
      dayOfMonth: input.payday,
      startDate: monthStart(
        input.receivedThisMonth ? addMonths(month, 1) : month,
      ),
      mode: "confirm",
    },
  };
}

export async function applySalarySetup(
  db: Db,
  input: SalarySetup,
  clock: { now: number; offsetMin: number; tz: string; today: LocalDate },
): Promise<void> {
  const plan = planSalarySetup(input, clock.today);
  await db.withTransactionAsync(async () => {
    await createRecurringRule(db, plan.rule, clock.now);
    if (plan.recordNow) {
      await createTransaction(
        db,
        {
          type: "income",
          amount: input.amount,
          title: "Salary",
          categoryId: systemCategoryId("salary"),
          walletId: input.walletId,
          occurredAt: epochFromLocal(clock.today, 12, 0, clock.offsetMin),
          offsetMin: clock.offsetMin,
          tz: clock.tz,
          timePrecision: "date",
        },
        clock.now,
      );
    }
  });
}
