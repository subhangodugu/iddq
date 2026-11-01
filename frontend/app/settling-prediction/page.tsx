"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ShieldCheck, Zap, AlertTriangle, ArrowRight, Info, Database } from "lucide-react";
import { fetchAnalyses, runAnalysis } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useChartTheme } from "@/components/ui/ChartFrame";

export default function SettlingPredictionPage() {
  const chart = useChartTheme();

  const [analysis, setAnalysis] = useState<any>(null);
  const [kSamples, setKSamples] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setInitialLoading(true);
    try {
      const runs = await fetchAnalyses(1);
      if (runs && runs.length > 0) setAnalysis(runs[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleRecalculate(k: number) {
    setKSamples(k);
    setLoading(true);
    try {
      const newRun = await runAnalysis({
        project_id: 1,
        name: `Settling Run (k=${k} samples)`,
        settling_k_samples: k,
        settling_repeatability_ua: 5.0,
      });
      setAnalysis(newRun);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const settling = analysis?.results_json?.settling || {};
  const realTransientData = settling.real_transient_curve || [];


  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Transient Settling-Time Prediction & Guarded Early Termination"
        subtitle="Predict fully-settled quiescent current from early transient samples, avoiding redundant tester PMU wait states while safeguarding defect detection."
        badge={{
          label: `k=${kSamples} (${(kSamples * 0.1).toFixed(1)} ms cutoff)`,
          variant: "live",
        }}
      />

      {/* KPI Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Early Sample Cutoff"
          value={`${(kSamples * 0.1).toFixed(1)} ms`}
          subtitle={`First ${kSamples} samples (0.1 ms)`}
          status="live"
          trend={{ value: "Legacy: 3.5 ms", positive: true }}
          icon={<Clock className="w-5 h-5 text-silicon-cyan" />}
        />

        <KpiCard
          title="ML Prediction Accuracy"
          value={settling.ml_mae_ua !== undefined ? `${settling.ml_mae_ua} µA` : (initialLoading ? "..." : "N/A")}
          subtitle={`Naive sample MAE: ${settling.baseline_mae_ua !== undefined ? `${settling.baseline_mae_ua} µA` : "—"}`}
          status="pass"
          trend={
            settling.baseline_mae_ua && settling.ml_mae_ua
              ? { value: `${Math.round((1 - settling.ml_mae_ua / settling.baseline_mae_ua) * 100)}% error reduction`, positive: true }
              : undefined
          }
          icon={<Zap className="w-5 h-5 text-silicon-emerald" />}
        />

        <KpiCard
          title="Prediction Interval Coverage"
          value={settling.interval_coverage_pct !== undefined ? `${settling.interval_coverage_pct}%` : (initialLoading ? "..." : "N/A")}
          subtitle={`Mean width: ${settling.mean_interval_width_ua !== undefined ? `${settling.mean_interval_width_ua} µA` : "—"}`}
          status="neutral"
          trend={{ value: "90% quantile bounds (q05, q95)", positive: true }}
          icon={<ShieldCheck className="w-5 h-5 text-silicon-cyan" />}
        />

        <KpiCard
          title="Safe Early Termination"
          value={settling.safe_early_termination_pct !== undefined ? `${settling.safe_early_termination_pct}%` : (initialLoading ? "..." : "N/A")}
          subtitle={`Time saved: ${settling.avg_settle_time_saved_ms !== undefined ? `${settling.avg_settle_time_saved_ms} ms/vec` : "—"}`}
          status="pass"
          trend={{ value: `Guarded by ${settling.repeatability_tolerance_ua || 5.0} µA`, positive: true }}
          icon={<Clock className="w-5 h-5 text-silicon-emerald" />}
        />
      </div>

      {/* Real Waveform Inspection Chart */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center space-x-2">
              <Zap className="w-4 h-4 text-silicon-cyan" />
              <span>Real Transient Response Waveform & Early Cutoff</span>
            </CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Evaluated directly from characterization die{" "}
              <span className="text-silicon-cyan font-bold">
                {settling.representative_die_uid || "L03W04X18Y09"}
              </span>{" "}
              (Vector {settling.representative_vector_id || 1}).
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[var(--text-muted)]">Early Cutoff:</span>
            {[3, 5, 10].map((k) => (
              <button
                key={k}
                onClick={() => handleRecalculate(k)}
                disabled={loading}
                className={`px-3 py-1 rounded-lg border transition-all ${
                  kSamples === k
                    ? "bg-silicon-cyan text-[rgb(var(--on-accent))] border-transparent shadow-sm"
                    : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                k={k} ({(k * 0.1).toFixed(1)} ms)
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {initialLoading ? (
            <div className="p-8">
              <SkeletonLoader variant="rect" className="h-64 w-full" />
            </div>
          ) : realTransientData.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={realTransientData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="time_ms" stroke={chart.axis} fontSize={11} />
                  <YAxis stroke={chart.axis} fontSize={11} unit=" µA" />
                  <Tooltip contentStyle={chart.tooltipStyle} />
                  <Legend />
                  <ReferenceLine
                    x={`${(kSamples * 0.1).toFixed(1)} ms`}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{ value: `Cutoff @ ${(kSamples * 0.1).toFixed(1)} ms`, fill: "#F59E0B", fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current_ua"
                    name="Transient Measured Current (µA)"
                    stroke="#00D2FF"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#00D2FF" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="settled_target_ua"
                    name="Target Settled Value (µA)"
                    stroke={chart.pass}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="upper_bound_ua"
                    name="Upper Conformal Bound (µA)"
                    stroke={chart.axis}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lower_bound_ua"
                    name="Lower Conformal Bound (µA)"
                    stroke={chart.axis}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12">
              <EmptyState
                icon={<Info className="w-8 h-8 text-[var(--text-muted)]" />}
                title="Transient Characterization Data Unavailable"
                description="Transient characterization datasets (iddq_transients.csv) must be ingested and processed in an analysis run to display high-speed waveform predictions."
                action={
                  <Link href="/datasets">
                    <Button variant="primary" size="sm" icon={<Database className="w-4 h-4" />}>
                      Upload Transient Dataset
                    </Button>
                  </Link>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engineering Policy Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
          <CardTitle className="text-base font-bold flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-silicon-emerald" />
            <span>ATE Early Termination Guard-Band Policy</span>
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Early termination of PMU current integration is authorized strictly when the 90% calibrated prediction interval width is less than or equal to the tester repeatability tolerance (<span className="text-silicon-cyan font-bold">5.0 µA</span>).
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-subtle)]">
              <div className="text-[var(--text-muted)]">Conformal Interval:</div>
              <div className="text-[var(--text-primary)] font-bold mt-1">Width &le; 5.0 µA</div>
              <div className="text-[11px] text-silicon-emerald mt-1">Authorized for early cutoff</div>
            </div>
            <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-subtle)]">
              <div className="text-[var(--text-muted)]">Boundary Overlap:</div>
              <div className="text-silicon-amber font-bold mt-1">Interval overlaps threshold</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">Mandatory full settling wait</div>
            </div>
            <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-subtle)]">
              <div className="text-[var(--text-muted)]">Shift / Outlier Die:</div>
              <div className="text-silicon-ruby font-bold mt-1">High uncertainty prediction</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">Fallback to full 3.5 ms wait</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
