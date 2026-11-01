"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Filter,
  Microscope,
  Disc,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Radio,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isLive?: boolean;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Telemetry & Cockpit",
    items: [
      { href: "/", label: "Executive Dashboard", icon: LayoutDashboard },
      { href: "/realtime", label: "Real-Time Prober", icon: Radio, isLive: true },
    ],
  },
  {
    label: "Data & Diagnostics",
    items: [
      { href: "/datasets", label: "Dataset Ingestion", icon: Database },
      { href: "/defects", label: "Detected Defects", icon: AlertTriangle },
      { href: "/die-analysis", label: "Die Diagnosis", icon: Microscope },
      { href: "/wafer-analysis", label: "Wafer & Lot Drift", icon: Disc },
    ],
  },
  {
    label: "Optimization Levers",
    items: [
      { href: "/baseline-screens", label: "Baseline Screens", icon: Filter },
      { href: "/settling-prediction", label: "Settling Prediction", icon: Clock },
      { href: "/vector-optimization", label: "Vector Optimization", icon: Layers },
      { href: "/adaptive-testing", label: "Adaptive Testing", icon: Sparkles },
    ],
  },
  {
    label: "Governance & Safety",
    items: [
      { href: "/validation-gates", label: "Release Gates", icon: ShieldCheck },
      { href: "/reports", label: "Reports & Lineage", icon: FileText },
    ],
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const drawerHidden = !isDesktop && !isMobileOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        inert={drawerHidden}
        aria-hidden={drawerHidden || undefined}
        className={`fixed md:sticky top-16 z-50 md:z-20 h-[calc(100vh-4rem)] border-r border-app-border bg-app-surface transition-all duration-300 flex flex-col justify-between shrink-0 ${
          collapsed ? "w-20" : "w-64"
        } ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {/* Mobile Close Button */}
          <div className="flex items-center justify-between pb-2 px-2 md:hidden border-b border-app-border">
            <span className="text-xs font-bold text-app-text uppercase tracking-wider">Navigation Menu</span>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-app-muted hover:text-app-text"
              aria-label="Close navigation drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!collapsed && (
                <div className="type-label px-3 pb-2 text-app-subtle">
                  {group.label}
                </div>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex min-h-10 items-center ${
                      collapsed ? "justify-center px-0" : "justify-between px-3"
                    } rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? "bg-silicon-cyan/10 text-silicon-cyan font-semibold border border-silicon-cyan/30 shadow-sm"
                        : "text-app-muted hover:text-app-text hover:bg-app-cardHover"
                    }`}
                  >
                    {/* Active Left Glow Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-silicon-cyan rounded-r-full shadow-glow-cyan" />
                    )}

                    <div className="flex items-center space-x-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-silicon-cyan"
                            : item.isLive
                            ? "text-silicon-cyan animate-pulse"
                            : "text-app-muted group-hover:text-app-text"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && item.isLive && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-silicon-cyan/20 text-silicon-cyan border border-silicon-cyan/40 animate-pulse">
                        LIVE
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Section: Collapse Toggle & Production Badge */}
        <div className="p-3 border-t border-app-border space-y-2 bg-app-card/40">
          {!collapsed && (
            <div className="space-y-1 rounded-xl border border-app-border bg-app-card p-2.5">
              <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-silicon-amber">
                <span className="w-1.5 h-1.5 rounded-full bg-silicon-amber" />
                <span>SHADOW EVALUATION</span>
              </div>
              <p className="type-numeric text-[10px] leading-tight text-app-subtle">
                Authoritative ATE baseline maintained. Zero leakage verified.
              </p>
            </div>
          )}

          {/* Collapse / Expand Toggle Button (Desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex min-h-10 w-full items-center justify-center rounded-xl p-2 text-sm text-app-muted hover:bg-app-cardHover hover:text-app-text"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-silicon-cyan" />
            ) : (
              <div className="flex items-center space-x-2 w-full justify-between px-2">
                <span className="text-[11px]">Collapse menu</span>
                <ChevronLeft className="w-4 h-4 text-app-subtle" />
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
