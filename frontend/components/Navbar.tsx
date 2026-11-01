"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Menu,
  Search,
  ChevronDown,
  Database,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { fetchHealth, loadSampleDatasets, runAnalysis, clearAllData } from "@/lib/api";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
}

const ANALYSIS_PAYLOAD = {
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
};

export default function Navbar({ onToggleMobileSidebar }: NavbarProps) {
  const { toast } = useToast();
  const [health, setHealth] = useState<{ status?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function checkHealth() {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch {
      setHealth({ status: "offline" });
    }
  }

  async function handleLoadSample() {
    setActionsOpen(false);
    setLoading(true);
    toast("Loading benchmark datasets…", "info");
    try {
      await loadSampleDatasets(1);
      toast("Benchmark datasets loaded.", "success");
      window.location.reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not load benchmark data.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunFullAnalysis() {
    setActionsOpen(false);
    setAnalyzing(true);
    toast("Running the optimization pipeline…", "info");
    try {
      await runAnalysis(ANALYSIS_PAYLOAD);
      toast("Optimization analysis complete.", "success");
      window.location.reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Analysis failed.", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleClearAll() {
    setLoading(true);
    try {
      await clearAllData();
      toast("All platform data was removed.", "success");
      setConfirmClear(false);
      window.location.reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not clear data.", "error");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || analyzing;
  const apiLive = health?.status === "healthy";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-app-border bg-app-surface/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-app-muted hover:bg-app-cardHover hover:text-app-text md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-card text-silicon-cyan">
              <Cpu className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-app-text sm:text-base">
                IDDQ Optimizer
              </span>
              <span className="hidden text-xs text-app-muted sm:block">Test-time and defect intelligence</span>
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 md:flex md:justify-center">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex w-full max-w-md items-center justify-between rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-app-muted hover:border-app-borderStrong hover:text-app-text"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search modules and actions
            </span>
            <kbd className="type-numeric rounded-md border border-app-border bg-app-surface px-1.5 py-0.5 text-[10px] text-app-muted">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-card text-app-muted hover:text-app-text md:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <div
            className="hidden items-center gap-2 rounded-xl border border-app-border bg-app-card px-2.5 py-2 text-xs text-app-muted sm:flex"
            title={apiLive ? "Backend API is healthy" : "Backend API is offline"}
          >
            <span className={`h-2 w-2 rounded-full ${apiLive ? "bg-silicon-emerald" : "bg-silicon-ruby"}`} />
            <span>{apiLive ? "API live" : "API offline"}</span>
          </div>

          <ThemeSwitcher />

          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => setActionsOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-silicon-cyan px-3 text-sm font-semibold text-[rgb(var(--on-accent))]"
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Actions
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {actionsOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-xl border border-app-border bg-app-surface p-1 shadow-xl"
              >
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={handleLoadSample}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-cardHover disabled:opacity-50"
                >
                  <Database className="h-4 w-4 text-silicon-cyan" />
                  Load benchmark
                </button>
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={handleRunFullAnalysis}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-cardHover disabled:opacity-50"
                >
                  <Play className="h-4 w-4 text-silicon-cyan" />
                  Run pipeline
                </button>
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setActionsOpen(false);
                    setConfirmClear(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-silicon-ruby hover:bg-silicon-ruby/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear all data
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Dialog
        open={confirmClear}
        danger
        title="Clear all platform data?"
        description="This removes datasets, analyses, defects, and runs. The action cannot be undone."
        confirmLabel="Clear data"
        loading={loading}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearAll}
      />

      <CommandPalette isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}
