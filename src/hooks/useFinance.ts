import { useState } from "react";

type Item = {
  id: number;
  name: string;
  amount: number;
};

export function useFinance() {
  const [salary, setSalary] = useState(0);
  const [expenses, setExpenses] = useState<Item[]>([]);
  const [savings, setSavings] = useState<Item[]>([]);

  const totalExpense = expenses.reduce((acc, item) => acc + item.amount, 0);
  const totalSaving = savings.reduce((acc, item) => acc + item.amount, 0);
  const remaining = salary - totalExpense - totalSaving;

  function addExpense(name: string, amount: number) {
    setExpenses((prev) => [...prev, { id: Date.now(), name, amount }]);
  }

  function addSaving(name: string, amount: number) {
    setSavings((prev) => [...prev, { id: Date.now(), name, amount }]);
  }

  function deleteExpense(id: number) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function deleteSaving(id: number) {
    setSavings((prev) => prev.filter((s) => s.id !== id));
  }

  return {
    salary,
    setSalary,
    expenses,
    savings,
    totalExpense,
    totalSaving,
    remaining,
    addExpense,
    addSaving,
    deleteExpense,
    deleteSaving,
  };
}
