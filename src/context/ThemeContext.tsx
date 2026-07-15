import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof darkColors;
};

const darkColors = {
  bg: "#000000",
  surface: "#0d0d0d",
  surface2: "#1a1a1a",
  border: "#2a2a2a",
  accent: "#c8f542",
  danger: "#ff3b3b",
  saving: "#3b82f6",
  text: "#ffffff",
  muted: "#555555",
  subtext: "#888888",
};

const lightColors = {
  bg: "#f5f5f5",
  surface: "#ffffff",
  surface2: "#eeeeee",
  border: "#dddddd",
  accent: "#5a9e0f",
  danger: "#e02020",
  saving: "#1d60cc",
  text: "#0a0a0a",
  muted: "#999999",
  subtext: "#666666",
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    async function loadTheme() {
      const saved = await AsyncStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    }
    loadTheme();
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    AsyncStorage.setItem("theme", next);
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        colors: theme === "dark" ? darkColors : lightColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}
