"use client";

import React from "react";
import { Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon = Database,
  action,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = "",
}: EmptyStateProps) {
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-7 h-7" />;
    }
    return <Database className="w-7 h-7" />;
  };

  return (
    <div
      className={`bg-app-card border border-dashed border-app-border rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto ${className}`}
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-app-cardHover border border-app-border flex items-center justify-center text-silicon-cyan shadow-sm">
        {renderIcon()}
      </div>

      <h3 className="type-section text-base mb-2">
        {title}
      </h3>

      <p className="type-secondary max-w-md mx-auto mb-6">
        {description}
      </p>

      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-3">{action}</div>
      ) : (
        (actionLabel || secondaryActionLabel) && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {actionLabel && onAction && (
              <Button variant="primary" size="sm" onClick={onAction}>
                {actionLabel}
              </Button>
            )}

            {secondaryActionLabel && onSecondaryAction && (
              <Button variant="secondary" size="sm" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
