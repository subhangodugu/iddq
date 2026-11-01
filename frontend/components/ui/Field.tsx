"use client";

import React from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, id, className = "", ...props }: FieldProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label htmlFor={inputId} className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && <span className="type-label">{label}</span>}
      <input
        id={inputId}
        className={`h-10 w-full rounded-xl border bg-app-bg px-3 text-sm text-app-text placeholder:text-app-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-silicon-cyan/50 ${
          error ? "border-silicon-ruby" : "border-app-border hover:border-app-borderStrong"
        }`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-silicon-ruby">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="type-caption">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
