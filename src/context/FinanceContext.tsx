import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export type Item = {
  id: number;
  name: string;
  amount: number;
  category: string;
  month: number;
  year: number;
  target?: number;
};

export type Budgets = Record<string, number>;
export type Salaries = Record<string, number>;

type FinanceContextType = {
  salary: number;
  setSalary: (val: number) => void;
  expenses: Item[];
  savings: Item[];
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number, year: number) => void;
  filteredExpenses: Item[];
  filteredSavings: Item[];
  totalExpense: number;
  totalSaving: number;
  remaining: number;
  addExpense: (name: string, amount: number, category: string) => void;
  addSaving: (
    name: string,
    amount: number,
    category: string,
    target?: number,
  ) => void;
  deleteExpense: (id: number) => void;
  deleteSaving: (id: number) => void;
  editExpense: (
    id: number,
    name: string,
    amount: number,
    category: string,
  ) => void;
  editSaving: (
    id: number,
    name: string,
    amount: number,
    category: string,
    target?: number,
  ) => void;
  budgets: Budgets;
  setBudget: (category: string, limit: number) => void;
  deleteBudget: (category: string) => void;
  expenseByCategory: Record<string, number>;
  resetData: () => void;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  savingChangePct: number | null;
};

const FinanceContext = createContext<FinanceContextType | null>(null);

function salaryKey(month: number, year: number) {
  return `${year}-${month}`;
}

function prevMonthOf(month: number, year: number) {
  if (month === 0) return { month: 11, year: year - 1 };
  return { month: month - 1, year };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // no baseline to compare against
  }
  return ((current - previous) / previous) * 100;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [salaries, setSalaries] = useState<Salaries>({});
  const [expenses, setExpenses] = useState<Item[]>([]);
  const [savings, setSavings] = useState<Item[]>([]);
  const [selectedMonth, setSelectedMonthState] = useState(now.getMonth());
  const [selectedYear, setSelectedYearState] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budgets>({});
  const isLoaded = useRef(false);

  // Load data dulu, baru boleh save
  useEffect(() => {
    async function loadData() {
      const sMap = await AsyncStorage.getItem("salaries");
      const legacySalary = await AsyncStorage.getItem("salary");
      const e = await AsyncStorage.getItem("expenses");
      const sv = await AsyncStorage.getItem("savings");
      const b = await AsyncStorage.getItem("budgets");

      if (sMap) {
        setSalaries(JSON.parse(sMap));
      } else if (legacySalary) {
        const key = salaryKey(now.getMonth(), now.getFullYear());
        setSalaries({ [key]: parseFloat(legacySalary) });
        await AsyncStorage.removeItem("salary");
      }

      if (e) setExpenses(JSON.parse(e));
      if (sv) setSavings(JSON.parse(sv));
      if (b) setBudgets(JSON.parse(b));
      isLoaded.current = true;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoaded.current) return;
    AsyncStorage.setItem("salaries", JSON.stringify(salaries));
  }, [salaries]);

  useEffect(() => {
    if (!isLoaded.current) return;
    AsyncStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    if (!isLoaded.current) return;
    AsyncStorage.setItem("savings", JSON.stringify(savings));
  }, [savings]);

  useEffect(() => {
    if (!isLoaded.current) return;
    AsyncStorage.setItem("budgets", JSON.stringify(budgets));
  }, [budgets]);

  const salary = salaries[salaryKey(selectedMonth, selectedYear)] || 0;

  const filteredExpenses = expenses.filter(
    (e) => e.month === selectedMonth && e.year === selectedYear,
  );
  const filteredSavings = savings.filter(
    (s) => s.month === selectedMonth && s.year === selectedYear,
  );

  const totalExpense = filteredExpenses.reduce(
    (acc, item) => acc + item.amount,
    0,
  );
  const totalSaving = filteredSavings.reduce(
    (acc, item) => acc + item.amount,
    0,
  );
  const remaining = salary - totalExpense - totalSaving;

  const expenseByCategory = filteredExpenses.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Perbandingan ke bulan sebelumnya
  const prev = prevMonthOf(selectedMonth, selectedYear);
  const prevSalary = salaries[salaryKey(prev.month, prev.year)] || 0;
  const prevExpense = expenses
    .filter((e) => e.month === prev.month && e.year === prev.year)
    .reduce((acc, item) => acc + item.amount, 0);
  const prevSaving = savings
    .filter((s) => s.month === prev.month && s.year === prev.year)
    .reduce((acc, item) => acc + item.amount, 0);

  const incomeChangePct = pctChange(salary, prevSalary);
  const expenseChangePct = pctChange(totalExpense, prevExpense);
  const savingChangePct = pctChange(totalSaving, prevSaving);

  function setSalary(val: number) {
    setSalaries((prev) => ({
      ...prev,
      [salaryKey(selectedMonth, selectedYear)]: val,
    }));
  }

  function setSelectedMonth(month: number, year: number) {
    setSelectedMonthState(month);
    setSelectedYearState(year);
  }

  function addExpense(name: string, amount: number, category: string) {
    const now = new Date();
    setExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        name,
        amount,
        category,
        month: now.getMonth(),
        year: now.getFullYear(),
      },
    ]);
  }

  function addSaving(
    name: string,
    amount: number,
    category: string,
    target?: number,
  ) {
    const now = new Date();
    setSavings((prev) => [
      ...prev,
      {
        id: Date.now(),
        name,
        amount,
        category,
        target,
        month: now.getMonth(),
        year: now.getFullYear(),
      },
    ]);
  }

  function deleteExpense(id: number) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function deleteSaving(id: number) {
    setSavings((prev) => prev.filter((s) => s.id !== id));
  }

  function editExpense(
    id: number,
    name: string,
    amount: number,
    category: string,
  ) {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name, amount, category } : e)),
    );
  }

  function editSaving(
    id: number,
    name: string,
    amount: number,
    category: string,
    target?: number,
  ) {
    setSavings((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, name, amount, category, target } : s,
      ),
    );
  }

  function setBudget(category: string, limit: number) {
    setBudgets((prev) => ({ ...prev, [category]: limit }));
  }

  function deleteBudget(category: string) {
    setBudgets((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  }

  async function resetData() {
    setExpenses([]);
    setSavings([]);
    setBudgets({});
    await AsyncStorage.multiRemove(["expenses", "savings", "budgets"]);
  }

  return (
    <FinanceContext.Provider
      value={{
        salary,
        setSalary,
        expenses,
        savings,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        filteredExpenses,
        filteredSavings,
        totalExpense,
        totalSaving,
        remaining,
        addExpense,
        addSaving,
        deleteExpense,
        deleteSaving,
        editExpense,
        editSaving,
        budgets,
        setBudget,
        deleteBudget,
        expenseByCategory,
        resetData,
        incomeChangePct,
        expenseChangePct,
        savingChangePct,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx)
    throw new Error("useFinance harus dipakai di dalam FinanceProvider");
  return ctx;
}
