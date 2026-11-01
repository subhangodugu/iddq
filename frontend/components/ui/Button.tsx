"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconPosition?: "left" | "right";
  children?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    xs: "px-2.5 py-1 text-[11px] gap-1.5 rounded-md",
    sm: "px-3 py-1.5 text-xs gap-2 rounded-lg",
    md: "px-4 py-2 text-xs gap-2 rounded-lg",
    lg: "px-5 py-2.5 text-sm gap-2.5 rounded-xl font-semibold",
  }[size];

  const variantClasses = {
    primary:
      "bg-silicon-cyan hover:brightness-110 text-[rgb(var(--on-accent))] font-semibold shadow-sm border border-transparent",
    secondary:
      "bg-app-cardHover hover:bg-app-surface text-app-text border border-app-border hover:border-app-borderStrong shadow-sm",
    outline:
      "bg-transparent hover:bg-app-cardHover text-app-text border border-app-border hover:border-app-borderStrong",
    ghost:
      "bg-transparent hover:bg-app-cardHover text-app-muted hover:text-app-text border border-transparent",
    danger:
      "bg-silicon-ruby/15 hover:bg-silicon-ruby/25 text-silicon-ruby border border-silicon-ruby/30 hover:border-silicon-ruby/60",
    success:
      "bg-silicon-emerald/15 hover:bg-silicon-emerald/25 text-silicon-emerald border border-silicon-emerald/30 hover:border-silicon-emerald/60",
  }[variant];

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-3.5 h-3.5 shrink-0" />;
    }
    return null;
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-sans transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : iconPosition === "left" ? (
        renderIcon()
      ) : null}

      {children && <span>{children}</span>}

      {!loading && iconPosition === "right" && renderIcon()}
    </button>
  );
}
