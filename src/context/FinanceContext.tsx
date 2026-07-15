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
};

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [salary, setSalaryState] = useState(0);
  const [expenses, setExpenses] = useState<Item[]>([]);
  const [savings, setSavings] = useState<Item[]>([]);
  const [selectedMonth, setSelectedMonthState] = useState(now.getMonth());
  const [selectedYear, setSelectedYearState] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budgets>({});
  const isLoaded = useRef(false);

  // Load data dulu, baru boleh save
  useEffect(() => {
    async function loadData() {
      const s = await AsyncStorage.getItem("salary");
      const e = await AsyncStorage.getItem("expenses");
      const sv = await AsyncStorage.getItem("savings");
      const b = await AsyncStorage.getItem("budgets");
      if (s) setSalaryState(parseFloat(s));
      if (e) setExpenses(JSON.parse(e));
      if (sv) setSavings(JSON.parse(sv));
      if (b) setBudgets(JSON.parse(b));
      isLoaded.current = true;
    }
    loadData();
  }, []);

  // Save hanya setelah data selesai di-load
  useEffect(() => {
    if (!isLoaded.current) return;
    AsyncStorage.setItem("salary", String(salary));
  }, [salary]);

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

  function setSalary(val: number) {
    setSalaryState(val);
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
