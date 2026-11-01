"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Radio,
  Database,
  AlertTriangle,
  Microscope,
  Disc,
  Filter,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  FileText,
  Play,
  RotateCcw,
  Sun,
  Moon,
  Command,
  ArrowRight,
  X
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { loadSampleDatasets, runAnalysis } from "@/lib/api";

interface CommandItem {
  id: string;
  category: "Navigation" | "Platform Actions" | "Theme";
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  badge?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: "nav-dash",
      category: "Navigation",
      title: "Executive Test Optimization Cockpit",
      subtitle: "Overview of IDDQ savings, baseline yield, and test time",
      icon: LayoutDashboard,
      action: () => { router.push("/"); onClose(); },
      shortcut: "G D",
    },
    {
      id: "nav-realtime",
      category: "Navigation",
      title: "Real-Time Prober Stream Monitor",
      subtitle: "Live ATE prober telemetry, WebSocket feed, and alarm ledger",
      icon: Radio,
      badge: "LIVE",
      action: () => { router.push("/realtime"); onClose(); },
      shortcut: "G R",
    },
    {
      id: "nav-datasets",
      category: "Navigation",
      title: "Dataset Ingestion & Readiness",
      subtitle: "Ingest, preview, and validate semiconductor CSV files",
      icon: Database,
      action: () => { router.push("/datasets"); onClose(); },
    },
    {
      id: "nav-defects",
      category: "Navigation",
      title: "Detected Defects & Taxonomy",
      subtitle: "Filterable physical defect ledger and classification",
      icon: AlertTriangle,
      action: () => { router.push("/defects"); onClose(); },
    },
    {
      id: "nav-die",
      category: "Navigation",
      title: "Die Diagnosis & Comparison",
      subtitle: "Vector profile curves, waveforms, and die comparison",
      icon: Microscope,
      action: () => { router.push("/die-analysis"); onClose(); },
    },
    {
      id: "nav-wafer",
      category: "Navigation",
      title: "Spatial Wafer Map & Lot Drift",
      subtitle: "60-wafer heatmaps, spatial neighborhoods, and PSI tracking",
      icon: Disc,
      action: () => { router.push("/wafer-analysis"); onClose(); },
    },
    {
      id: "nav-screens",
      category: "Navigation",
      title: "Baseline IDDQ Screening",
      subtitle: "Compare 6 screening models & analyze LOT12 shift overkill",
      icon: Filter,
      action: () => { router.push("/baseline-screens"); onClose(); },
    },
    {
      id: "nav-settling",
      category: "Navigation",
      title: "Settling & Transient Prediction",
      subtitle: "Sub-millisecond settling prediction using early transient k-samples",
      icon: Clock,
      action: () => { router.push("/settling-prediction"); onClose(); },
    },
    {
      id: "nav-vectors",
      category: "Navigation",
      title: "Vector Set Cover Optimization",
      subtitle: "Greedy vector reduction maintaining 100% defect coverage",
      icon: Layers,
      action: () => { router.push("/vector-optimization"); onClose(); },
    },
    {
      id: "nav-adaptive",
      category: "Navigation",
      title: "Adaptive Testing Simulator",
      subtitle: "Dynamic early-exit and high-risk wafer audit policies",
      icon: Sparkles,
      action: () => { router.push("/adaptive-testing"); onClose(); },
    },
    {
      id: "nav-gates",
      category: "Navigation",
      title: "Release Gates Verification",
      subtitle: "Zero-defect escape, overkill bounds, and safety verifications",
      icon: ShieldCheck,
      action: () => { router.push("/validation-gates"); onClose(); },
    },
    {
      id: "nav-reports",
      category: "Navigation",
      title: "Audit Reports & Data Lineage",
      subtitle: "Engineering compliance certificates and downloadable CSVs",
      icon: FileText,
      action: () => { router.push("/reports"); onClose(); },
    },

    // Actions
    {
      id: "action-sample",
      category: "Platform Actions",
      title: "Load Benchmark Datasets",
      subtitle: "Auto-ingest 32,400 benchmark die, transients, and faults",
      icon: Database,
      action: async () => {
        onClose();
        try {
          await loadSampleDatasets(1);
          window.location.reload();
        } catch (e: unknown) {
          toast(e instanceof Error ? e.message : "Failed to load benchmark.", "error");
        }
      },
    },
    {
      id: "action-pipeline",
      category: "Platform Actions",
      title: "Execute Full AI Optimization Pipeline",
      subtitle: "Run all 6 screens, vector set cover, and settling models across all 12 lots",
      icon: Play,
      action: async () => {
        onClose();
        try {
          await runAnalysis({
            project_id: 1,
            name: "Production IDDQ Benchmark Optimization",
            fixed_limit_ua: 450.0,
            ratio_quantile: 0.995,
            settling_k_samples: 5,
            vector_target_coverage_pct: 100.0,
            adaptive_risk_threshold: 0.20,
            adaptive_audit_fraction: 0.05,
            annual_volume: 10000000,
            tester_cost_per_second: 0.05,
          });
          window.location.reload();
        } catch (e: unknown) {
          toast(e instanceof Error ? e.message : "Failed to run analysis.", "error");
        }
      },
    },

    // Theme
    {
      id: "theme-toggle",
      category: "Theme",
      title: resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      subtitle: `Current active theme: ${theme}`,
      icon: resolvedTheme === "dark" ? Sun : Moon,
      action: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        onClose();
      },
    },
  ], [router, theme, resolvedTheme, onClose, setTheme, toast]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-app-border/80 gap-3 bg-app-surface/50">
          <Search className="w-5 h-5 text-silicon-cyan shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or navigate to module..."
            className="w-full bg-transparent text-sm text-app-text placeholder:text-app-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-app-muted hover:bg-app-cardHover hover:text-app-text"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-app-muted">
              No matching commands or navigation routes found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-silicon-cyan/15 text-app-text border border-silicon-cyan/30"
                      : "text-app-muted hover:text-app-text hover:bg-app-cardHover border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-silicon-cyan/20 text-silicon-cyan border border-silicon-cyan/40"
                          : "bg-app-surface text-app-muted border border-app-border"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-app-text truncate flex items-center space-x-2">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-silicon-ruby/20 text-silicon-ruby border border-silicon-ruby/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-app-muted truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 rounded text-[10px] bg-app-surface border border-app-border text-app-muted font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-silicon-cyan" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 bg-app-surface/60 border-t border-app-border/80 flex items-center justify-between text-[11px] text-app-muted">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-app-card border border-app-border rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-app-card border border-app-border rounded text-[10px]">↓</kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-app-card border border-app-border rounded text-[10px]">↵</kbd>
              <span className="ml-1">Select</span>
            </span>
          </div>
          <span className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-app-card border border-app-border rounded text-[10px]">ESC</kbd>
            <span className="ml-1">Close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
