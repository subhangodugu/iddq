"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, CheckCircle2, AlertOctagon, TrendingUp, Info, Activity, Database } from "lucide-react";
import { fetchAnalyses } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function BaselineScreensPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedScreen, setSelectedScreen] = useState<string>("current_ratio");

  useEffect(() => {
    setLoading(true);
    fetchAnalyses(1)
      .then((runs) => {
        if (runs && runs.length > 0) {
          setAnalysis(runs[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const screens = analysis?.results_json?.screens || {};
  const activeScreen = screens[selectedScreen] || {};
  const screenKeys = Object.keys(screens);

  // Auto-select first screen if current is not in keys
  useEffect(() => {
    if (screenKeys.length > 0 && !screens[selectedScreen]) {
      setSelectedScreen(screenKeys[0]);
    }
  }, [screens, selectedScreen, screenKeys]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Baseline IDDQ Screening & Multivariate Outlier Detection"
        subtitle="Evaluates and compares the 6 screening algorithms on production die, with specific focus on LOT12 process shift overkill."
        badge={{
          label: screenKeys.length > 0 ? `${screenKeys.length} Screening Models` : "Standby",
          variant: screenKeys.length > 0 ? "live" : "neutral",
        }}
      />

      {loading ? (
        <div className="space-y-6">
          <SkeletonLoader variant="rect" className="h-12 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonLoader variant="card" className="h-96" />
            <SkeletonLoader variant="card" className="h-96 lg:col-span-2" />
          </div>
        </div>
      ) : screenKeys.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<Filter className="w-10 h-10 text-[var(--text-muted)]" />}
              title="No Screening Analysis Runs Found"
              description="Screening performance data is generated when an analysis pipeline run completes. Ingest a dataset and execute an analysis run to view screening comparisons."
              action={
                <Link href="/datasets">
                  <Button variant="primary" size="sm" icon={<Database className="w-4 h-4" />}>
                    Go to Datasets & Upload
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Screen Selection Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-3">
            {Object.entries(screens).map(([key, item]: [string, any]) => {
              const isSelected = selectedScreen === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedScreen(key)}
                  className={`min-h-10 rounded-xl px-4 text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-silicon-cyan text-[rgb(var(--on-accent))] shadow-sm"
                      : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {item.screen_name}
                </button>
              );
            })}
          </div>

          {/* Active Screen Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metric Cards */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
                  <div className="type-label">Active Screen Algorithm</div>
                  <CardTitle className="text-lg font-bold text-[var(--text-primary)] tracking-tight mt-1">
                    {activeScreen.screen_name}
                  </CardTitle>
                  <div className="text-xs text-silicon-cyan mt-1">
                    Threshold: {activeScreen.threshold_desc}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Recall (Sensitivity):</span>
                      <span className="text-silicon-emerald font-bold">
                        {((activeScreen.recall || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Precision (PPV):</span>
                      <span className="text-[var(--text-primary)] font-bold">
                        {((activeScreen.precision || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Specificity:</span>
                      <span className="text-[var(--text-primary)]">
                        {((activeScreen.specificity || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Overkill Rate (FPR):</span>
                      <span className="text-silicon-amber font-semibold">
                        {((activeScreen.overkill_rate || 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Escapes (FN):</span>
                      <span className="text-silicon-ruby font-bold">
                        {activeScreen.false_negatives ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-[var(--text-muted)]">LOT12 Overkill:</span>
                      <span className="text-silicon-cyan font-bold">
                        {activeScreen.lot12_summary?.fp ?? "N/A"} good die
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2x2 Confusion Matrix */}
              <Card>
                <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
                  <CardTitle className="type-label">
                    Confusion Matrix (Counts)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-3 text-center text-xs">
                    <div className="p-3 bg-[var(--bg-canvas)] border border-silicon-emerald/30 rounded-lg">
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">True Positives (TP)</div>
                      <div className="text-xl font-bold text-silicon-emerald mt-1">
                        {(activeScreen.true_positives || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--bg-canvas)] border border-silicon-amber/30 rounded-lg">
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">False Positives (FP)</div>
                      <div className="text-xl font-bold text-silicon-amber mt-1">
                        {(activeScreen.false_positives || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--bg-canvas)] border border-silicon-ruby/30 rounded-lg">
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">False Negatives (FN)</div>
                      <div className="text-xl font-bold text-silicon-ruby mt-1">
                        {(activeScreen.false_negatives || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-lg">
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">True Negatives (TN)</div>
                      <div className="text-xl font-bold text-[var(--text-secondary)] mt-1">
                        {(activeScreen.true_negatives || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column 2 & 3: Defect Type Breakdown & Lot Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Defect Type Breakdown Table */}
              <Card>
                <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
                  <CardTitle className="text-sm font-bold flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-silicon-cyan" />
                    <span>Recall Performance by Defect Taxonomy</span>
                  </CardTitle>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Electrical detection capability across the 4 physical defect models.
                  </p>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full type-numeric text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 text-[var(--text-muted)]">
                          <th className="py-3 px-4">Defect Taxonomy</th>
                          <th className="py-3 px-4 text-right">Total Injected</th>
                          <th className="py-3 px-4 text-right">Detected</th>
                          <th className="py-3 px-4 text-right">Class Recall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {Object.entries(activeScreen.performance_by_defect_type || {}).map(
                          ([dtype, ddata]: [string, any]) => (
                            <tr key={dtype} className="hover:bg-[var(--bg-surface)]/60 transition-colors">
                              <td className="py-3 px-4 text-[var(--text-primary)] font-semibold uppercase">
                                {dtype.replace(/_/g, " ")}
                              </td>
                              <td className="py-3 px-4 text-right text-[var(--text-muted)]">{ddata.total}</td>
                              <td className="py-3 px-4 text-right text-silicon-emerald font-bold">{ddata.caught}</td>
                              <td className="py-3 px-4 text-right">
                                <StatusBadge
                                  status={ddata.recall > 0.5 ? "pass" : "warning"}
                                  label={`${(ddata.recall * 100).toFixed(1)}%`}
                                />
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Lot by Lot Breakdown */}
              <Card>
                <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
                  <CardTitle className="text-sm font-bold">
                    Lot-by-Lot Screen Breakdown (LOT01 – LOT12)
                  </CardTitle>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Observe how LOT12 (process shift lot) drives catastrophic overkill on legacy fixed limits, but is protected by normalized ratio screens.
                  </p>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full type-numeric text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-card)] text-[var(--text-muted)] z-10">
                          <th className="py-3 px-4">Lot ID</th>
                          <th className="py-3 px-4 text-right">Die</th>
                          <th className="py-3 px-4 text-right">Flagged</th>
                          <th className="py-3 px-4 text-right">True Positives</th>
                          <th className="py-3 px-4 text-right">False Alarms (Overkill)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {Object.entries(activeScreen.performance_by_lot || {}).map(([lot, ldata]: [string, any]) => {
                          const isShiftLot = lot === "LOT12";
                          return (
                            <tr
                              key={lot}
                              className={`hover:bg-[var(--bg-surface)]/60 transition-colors ${
                                isShiftLot ? "bg-silicon-amber/10 font-bold" : ""
                              }`}
                            >
                              <td className="py-3 px-4 text-[var(--text-primary)] flex items-center space-x-2">
                                <span>{lot}</span>
                                {isShiftLot && (
                                  <StatusBadge status="warning" label="PROCESS SHIFT" />
                                )}
                              </td>
                              <td className="py-3 px-4 text-right text-[var(--text-muted)]">{ldata.total}</td>
                              <td className="py-3 px-4 text-right text-[var(--text-primary)]">{ldata.flagged}</td>
                              <td className="py-3 px-4 text-right text-silicon-emerald">{ldata.tp}</td>
                              <td
                                className={`py-3 px-4 text-right ${
                                  ldata.fp > 100 ? "text-silicon-ruby font-bold" : "text-[var(--text-secondary)]"
                                }`}
                              >
                                {ldata.fp}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
