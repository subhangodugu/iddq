"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
}

export function Select({
  label,
  hint,
  error,
  id,
  options,
  children,
  className = "",
  ...props
}: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label htmlFor={selectId} className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && <span className="type-label">{label}</span>}
      <span className="relative block">
        <select
          id={selectId}
          className={`h-10 w-full appearance-none rounded-xl border bg-app-bg pl-3 pr-9 text-sm text-app-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-silicon-cyan/50 ${
            error ? "border-silicon-ruby" : "border-app-border hover:border-app-borderStrong"
          }`}
          aria-invalid={error ? true : undefined}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
      </span>
      {error ? (
        <span className="text-xs text-silicon-ruby">{error}</span>
      ) : hint ? (
        <span className="type-caption">{hint}</span>
      ) : null}
    </label>
  );
}
