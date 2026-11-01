"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  status?: "defect" | "live" | "neutral" | "warning" | string;
  trend?: {
    value: string;
    isPositive?: boolean;
    positive?: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  badge?: string;
  badgeVariant?: "emerald" | "cyan" | "ruby" | "amber" | "neutral";
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  status,
  trend,
  badge,
  badgeVariant = "cyan",
  className = "",
}: KpiCardProps) {
  const badgeClasses = {
    emerald: "bg-silicon-emerald/15 text-silicon-emerald border-silicon-emerald/30",
    cyan: "bg-silicon-cyan/15 text-silicon-cyan border-silicon-cyan/30",
    ruby: "bg-silicon-ruby/15 text-silicon-ruby border-silicon-ruby/30",
    amber: "bg-silicon-amber/15 text-silicon-amber border-silicon-amber/30",
    neutral: "bg-app-cardHover text-app-muted border-app-border",
  }[badgeVariant];

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-4 h-4" />;
    }
    return null;
  };

  const isPos = trend ? (trend.positive ?? trend.isPositive ?? false) : false;

  return (
    <div
      className={`bg-app-card border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-app-borderStrong transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="type-label truncate" title={title}>
            {title}
          </span>
          {icon && (
            <div className="p-1.5 rounded-lg bg-app-cardHover border border-app-border/60 text-silicon-cyan shrink-0">
              {renderIcon()}
            </div>
          )}
        </div>

        <div className="flex items-baseline space-x-2 my-1">
          <span className="type-numeric text-2xl sm:text-3xl font-semibold text-app-text">
            {value}
          </span>
          {badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${badgeClasses}`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-app-border/60 flex items-center justify-between text-xs text-app-muted">
        {subtitle && <span className="text-[11px] truncate">{subtitle}</span>}
        {trend && (
          <div
            className={`flex items-center space-x-1 font-semibold text-[11px] ${
              trend.isNeutral
                ? "text-app-muted"
                : isPos
                ? "text-silicon-emerald"
                : "text-silicon-ruby"
            }`}
          >
            {trend.isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : isPos ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{trend.value}</span>
            {trend.label && <span className="font-normal text-app-muted opacity-80">({trend.label})</span>}
          </div>
        )}
      </div>
    </div>
  );
}
