"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, ChevronDown } from "lucide-react";
import { useTheme, Theme } from "@/components/theme/ThemeProvider";

export default function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "dark", label: "Dark Mode", icon: Moon },
    { value: "light", label: "Light Mode", icon: Sun },
    { value: "system", label: "System Auto", icon: Laptop },
  ];

  const CurrentIcon = theme === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center space-x-1.5 rounded-xl border border-app-border bg-app-card px-2.5 text-sm text-app-text hover:bg-app-cardHover"
        title={`Current theme: ${theme} (${resolvedTheme})`}
        aria-label="Toggle theme"
      >
        <CurrentIcon className="w-3.5 h-3.5 text-silicon-cyan transition-transform duration-300" />
        <span className="hidden sm:inline capitalize font-medium">{theme}</span>
        <ChevronDown className="w-3 h-3 text-app-muted opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-40 rounded-xl border border-app-border bg-app-surface py-1 text-sm shadow-2xl">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-silicon-cyan/15 text-silicon-cyan font-semibold"
                    : "text-app-text hover:bg-app-cardHover"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-silicon-cyan" : "text-app-muted"}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
