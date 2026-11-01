"use client";

import React from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export type BadgeDescriptor = {
  label: string;
  variant?: "defect" | "live" | "neutral" | "success" | "warning" | string;
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode | BadgeDescriptor;
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  showBreadcrumbs = true,
  className = "",
}: PageHeaderProps) {
  const renderBadge = () => {
    if (!badge) return null;
    if (React.isValidElement(badge)) return badge;
    if (typeof badge === "object" && "label" in badge) {
      const b = badge as BadgeDescriptor;
      let badgeStyle = "bg-app-cardHover text-app-muted border-app-border";
      if (b.variant === "defect") {
        badgeStyle = "bg-silicon-ruby/20 text-silicon-ruby border-silicon-ruby/30";
      } else if (b.variant === "live") {
        badgeStyle = "bg-silicon-emerald/20 text-silicon-emerald border-silicon-emerald/30";
      } else if (b.variant === "warning") {
        badgeStyle = "bg-silicon-amber/20 text-silicon-amber border-silicon-amber/30";
      }
      return (
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono border font-medium ${badgeStyle}`}>
          {b.label}
        </span>
      );
    }
    return <span>{badge as any}</span>;
  };

  return (
    <div className={`space-y-3 pb-6 border-b border-app-border/70 ${className}`}>
      {showBreadcrumbs && <Breadcrumbs />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-2 rounded-xl bg-silicon-cyan/15 text-silicon-cyan border border-silicon-cyan/30 shadow-sm shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <h1 className="type-page flex flex-wrap items-center gap-2.5">
              <span>{title}</span>
              {renderBadge()}
            </h1>
          </div>

          {subtitle && (
            <p className="type-secondary max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
