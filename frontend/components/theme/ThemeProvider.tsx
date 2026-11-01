"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read saved preference from localStorage
    const saved = localStorage.getItem("iddq_theme_mode") as Theme | null;
    const initialTheme: Theme = saved || "dark";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);

    // System theme change listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = localStorage.getItem("iddq_theme_mode") as Theme | null;
      if (current === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  function applyTheme(targetTheme: Theme) {
    const root = document.documentElement;
    let effective: "dark" | "light" = "dark";

    if (targetTheme === "system") {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effective = isSystemDark ? "dark" : "light";
    } else {
      effective = targetTheme;
    }

    root.classList.remove("dark", "light");
    root.classList.add(effective);
    root.setAttribute("data-theme", effective);
    root.style.colorScheme = effective;
    setResolvedTheme(effective);
  }

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    localStorage.setItem("iddq_theme_mode", newTheme);
    applyTheme(newTheme);
  }

  function toggleTheme() {
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  // Prevent flash of unstyled theme on initial SSR load
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
