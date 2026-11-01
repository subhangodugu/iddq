"use client";

import React from "react";
import { ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/theme/ThemeProvider";

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return {
    isDark,
    grid: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    axis: isDark ? "#94A3B8" : "#475569",
    tooltipStyle: {
      backgroundColor: isDark ? "#101B24" : "#FFFFFF",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0"}`,
      borderRadius: 12,
      fontSize: 12,
      color: isDark ? "#F8FAFC" : "#0F172A",
    } as React.CSSProperties,
    pass: isDark ? "#22C55E" : "#15803D",
    fail: isDark ? "#F05252" : "#B91C1C",
    info: isDark ? "#2DD4BF" : "#0F766E",
    warn: isDark ? "#F0A63A" : "#B45309",
    accent: isDark ? "#38BDF8" : "#0369A1",
  };
}

interface ChartFrameProps {
  height?: number;
  children: React.ReactElement;
  className?: string;
}

export function ChartFrame({ height = 280, children, className = "" }: ChartFrameProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
