"use client";

import React from "react";

export function Table({
  children,
  className = "",
  caption,
}: {
  children: React.ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-app-border text-app-muted">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-app-border/70">{children}</tbody>;
}

export function Tr({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`transition-colors hover:bg-app-cardHover/50 ${className}`}>{children}</tr>;
}

export function Th({
  children,
  className = "",
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`type-label px-3 py-3 font-medium normal-case tracking-normal ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  align = "left",
  numeric = false,
  colSpan,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  numeric?: boolean;
  colSpan?: number;
  title?: string;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td title={title} colSpan={colSpan} className={`px-3 py-3 text-app-text ${numeric ? "type-numeric text-xs" : ""} ${alignClass} ${className}`}>
      {children}
    </td>
  );
}
