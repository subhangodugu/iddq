"use client";

import React from "react";

export type StatusVariant =
  | "pass"
  | "defect"
  | "outlier"
  | "pending"
  | "live"
  | "warning"
  | "info"
  | "neutral";

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  dot = true,
  className = "",
}: StatusBadgeProps) {
  const styles: Record<StatusVariant, { bg: string; text: string; border: string; dotColor: string; defaultLabel: string }> = {
    pass: {
      bg: "bg-silicon-emerald/15",
      text: "text-silicon-emerald",
      border: "border-silicon-emerald/30",
      dotColor: "bg-silicon-emerald",
      defaultLabel: "PASS",
    },
    defect: {
      bg: "bg-silicon-ruby/15",
      text: "text-silicon-ruby",
      border: "border-silicon-ruby/30",
      dotColor: "bg-silicon-ruby",
      defaultLabel: "DEFECT",
    },
    outlier: {
      bg: "bg-silicon-amber/15",
      text: "text-silicon-amber",
      border: "border-silicon-amber/30",
      dotColor: "bg-silicon-amber",
      defaultLabel: "OUTLIER",
    },
    pending: {
      bg: "bg-app-cardHover",
      text: "text-app-muted",
      border: "border-app-border",
      dotColor: "bg-app-muted",
      defaultLabel: "PENDING",
    },
    live: {
      bg: "bg-silicon-cyan/15",
      text: "text-silicon-cyan",
      border: "border-silicon-cyan/40",
      dotColor: "bg-silicon-cyan",
      defaultLabel: "LIVE",
    },
    warning: {
      bg: "bg-yellow-500/15",
      text: "text-yellow-500",
      border: "border-yellow-500/30",
      dotColor: "bg-yellow-500",
      defaultLabel: "WARNING",
    },
    info: {
      bg: "bg-silicon-blue/15",
      text: "text-silicon-blue",
      border: "border-silicon-blue/30",
      dotColor: "bg-silicon-blue",
      defaultLabel: "INFO",
    },
    neutral: {
      bg: "bg-app-cardHover",
      text: "text-app-text",
      border: "border-app-border",
      dotColor: "bg-app-borderStrong",
      defaultLabel: "NORMAL",
    },
  };

  const style = styles[status] || styles.neutral;
  const displayText = label || style.defaultLabel;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {dot && <span className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${style.dotColor}`} />}
      <span>{displayText}</span>
    </span>
  );
}
