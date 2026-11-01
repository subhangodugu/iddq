"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "glass" | "highlight";
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  }[padding];

  const variantClasses = {
    default: "bg-app-card border border-app-border rounded-2xl shadow-sm",
    interactive:
      "bg-app-card border border-app-border rounded-2xl shadow-sm hover:shadow-md hover:border-silicon-cyan/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
    glass:
      "bg-app-card/80 backdrop-blur-md border border-app-border rounded-2xl shadow-lg",
    highlight:
      "bg-gradient-to-br from-app-card via-app-card to-silicon-cyan/5 border border-silicon-cyan/30 rounded-2xl shadow-md",
  }[variant];

  return (
    <div
      className={`${variantClasses} ${paddingClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between pb-4 border-b border-app-border/70 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-sm font-semibold text-app-text tracking-tight flex items-center space-x-2 ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-xs text-app-muted mt-0.5 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`pt-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`pt-4 mt-4 border-t border-app-border/70 flex items-center justify-between text-xs text-app-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
