"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "card" | "kpi" | "table" | "text" | "rect";
  count?: number;
}

export function SkeletonLoader({
  variant = "rect",
  count = 1,
  className = "",
  ...props
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-app-cardHover/70 rounded-lg";

  if (variant === "kpi") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-app-card border border-app-border rounded-2xl p-5 space-y-3">
            <div className={`h-3 w-24 ${baseClasses}`} />
            <div className={`h-8 w-32 ${baseClasses}`} />
            <div className={`h-3 w-full ${baseClasses}`} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="space-y-2">
        <div className={`h-10 w-full ${baseClasses}`} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-12 w-full ${baseClasses}`} />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="bg-app-card border border-app-border rounded-2xl p-6 space-y-4">
        <div className={`h-5 w-48 ${baseClasses}`} />
        <div className={`h-32 w-full ${baseClasses}`} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${baseClasses} ${className}`} {...props} />
      ))}
    </div>
  );
}
