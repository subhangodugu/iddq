"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Cpu,
  Layers,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertOctagon,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Database,
  Radio,
  Play,
  RotateCcw
} from "lucide-react";
import { fetchAnalyses, fetchReadiness, runAnalysis } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [read, runs] = await Promise.all([
        fetchReadiness(1).catch(() => null),
        fetchAnalyses(1).catch(() => []),
      ]);
      setReadiness(read);
      if (runs && runs.length > 0) {
        setAnalysis(runs[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerRun() {
    setRunning(true);
    try {
      const newRun = await runAnalysis({
        project_id: 1,
        name: "Production IDDQ Optimization Run",
        fixed_limit_ua: 450.0,
        ratio_quantile: 0.995,
        settling_k_samples: 5,
        vector_target_coverage_pct: 100.0,
        adaptive_risk_threshold: 0.20,
        adaptive_audit_fraction: 0.05,
        annual_volume: 10000000,
        tester_cost_per_second: 0.05,
      });
      setAnalysis(newRun);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  const kpis = analysis?.results_json?.kpis || analysis?.kpis || {};
  const cost = analysis?.results_json?.cost || {};
  const screens = analysis?.results_json?.screens || {};
  const gates = analysis?.results_json?.gates || {};
  const adaptive = analysis?.results_json?.adaptive || {};
  const vectorOpt = analysis?.results_json?.vector_opt || {};
  const settling = analysis?.results_json?.settling || {};

  const hasAnalysis = Boolean(analysis && (kpis.total_die !== undefined || kpis.legacy_caught !== undefined));

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8">
      {/* Page Header */}
      <PageHeader
        title="Executive Test Optimization Cockpit"
        subtitle="Data-driven IDDQ test time reduction, settling prediction, and precision outlier screening across 12 production lots."
        icon={Cpu}
        badge={
          hasAnalysis ? (
            <StatusBadge
              status="pass"
              label={gates.overall_status || "Analysis Completed"}
            />
          ) : (
            <StatusBadge status="warning" label="Awaiting Benchmark Data" />
          )
        }
        actions={
          <div className="flex items-center space-x-3">
            <div className="bg-app-card border border-app-border px-3 py-1.5 rounded-xl text-xs flex items-center space-x-2">
              <span className="text-app-muted">Readiness:</span>
              <span className="text-silicon-cyan font-bold">
                {readiness?.readiness_score ?? (hasAnalysis ? 100 : 0)}%
              </span>
            </div>

            <Button
              variant="primary"
              size="sm"
              loading={running}
              onClick={handleTriggerRun}
              icon={Play}
            >
              {hasAnalysis ? "Re-Run Optimization" : "Execute Pipeline"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-4 w-4 text-silicon-cyan" />
          <div>
            <p className="text-sm font-medium text-app-text">Live prober</p>
            <p className="type-caption">Stream dies, settling traces, and defect events as they are probed.</p>
          </div>
        </div>
        <Link
          href="/realtime"
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl bg-silicon-cyan px-3 text-sm font-semibold text-[rgb(var(--on-accent))] sm:self-auto"
        >
          <span>Open studio</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="type-label">Test time saved</span>
            <Clock className="h-4 w-4 text-silicon-cyan" />
          </div>
          <div className="type-numeric mb-1 text-3xl font-semibold text-app-text">
            {hasAnalysis && cost.time_reduction_pct !== undefined ? `${cost.time_reduction_pct}%` : "0.0%"}
          </div>
          <p className="type-caption">
            Per die{" "}
            <span className="type-numeric text-silicon-cyan">
              {hasAnalysis && cost.optimized_time_ms !== undefined ? `${cost.optimized_time_ms} ms` : "—"}
            </span>{" "}
            from {cost.baseline_time_ms || 85.0} ms
          </p>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="type-label">Net annual value</span>
            <DollarSign className="h-4 w-4 text-silicon-emerald" />
          </div>
          <div className="type-numeric mb-1 text-3xl font-semibold text-silicon-emerald">
            {hasAnalysis && cost.net_estimated_benefit !== undefined
              ? `$${cost.net_estimated_benefit.toLocaleString()}`
              : "$0"}
          </div>
          <p className="type-caption">
            {(cost.annual_volume || 10000000).toLocaleString()} die/yr at $0.05/s
          </p>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="type-label">Screen recall</span>
            <Target className="h-4 w-4 text-silicon-blue" />
          </div>
          <div className="type-numeric mb-1 text-3xl font-semibold text-app-text">
            {hasAnalysis && kpis.ratio_recall_pct ? kpis.ratio_recall_pct : "0.0%"}
          </div>
          <p className="type-caption">
            Legacy 450 µA recall <span className="type-numeric text-silicon-ruby">{kpis.legacy_recall_pct || "—"}</span>
          </p>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="type-label">Overkill reduction</span>
            <ShieldCheck className="h-4 w-4 text-silicon-amber" />
          </div>
          <div className="type-numeric mb-1 text-3xl font-semibold text-app-text">
            {hasAnalysis && kpis.legacy_false_alarms && kpis.ratio_false_alarms
              ? `${Math.round((1 - kpis.ratio_false_alarms / kpis.legacy_false_alarms) * 100)}%`
              : "0%"}
          </div>
          <p className="type-caption">
            <span className="type-numeric text-silicon-emerald">{kpis.ratio_false_alarms ?? "0"}</span>
            {" false alarms vs "}
            <span className="type-numeric text-silicon-ruby">{kpis.legacy_false_alarms ?? "0"}</span>
          </p>
        </Card>
      </div>

      {/* Production Metrics Grid: Traceable Real Counts */}
      {loading ? (
        <SkeletonLoader variant="kpi" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Uploaded Die"
            value={hasAnalysis && kpis.total_die !== undefined ? kpis.total_die.toLocaleString() : "0"}
            subtitle={hasAnalysis ? "12 Lots / 60 Wafers" : "Zero active data"}
            icon={Database}
          />
          <KpiCard
            title="Detected Defects"
            value={hasAnalysis && kpis.detected_defects_count !== undefined ? kpis.detected_defects_count.toLocaleString() : "0"}
            subtitle="Across all screening models"
            icon={AlertTriangle}
            badgeVariant="cyan"
          />
          <KpiCard
            title="Confirmed Defects"
            value={hasAnalysis && kpis.total_defects !== undefined ? kpis.total_defects.toLocaleString() : "0"}
            subtitle="Ground-truth verified"
            icon={CheckCircle2}
            badgeVariant="ruby"
          />
          <KpiCard
            title="Ratio Screen Caught"
            value={hasAnalysis && kpis.ratio_caught !== undefined ? kpis.ratio_caught.toLocaleString() : "0"}
            subtitle={`Recall: ${kpis.ratio_recall_pct || "0.0%"}`}
            icon={Target}
            badgeVariant="emerald"
          />
          <KpiCard
            title="Ratio False Alarms"
            value={hasAnalysis && kpis.ratio_false_alarms !== undefined ? kpis.ratio_false_alarms.toLocaleString() : "0"}
            subtitle={`Legacy alarms: ${kpis.legacy_false_alarms ?? "0"}`}
            icon={ShieldCheck}
            badgeVariant="amber"
          />
        </div>
      )}


      {/* Main Grid: Screening Performance Benchmark & Levers Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Screening Benchmark Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  <BarChart3 className="w-4 h-4 text-silicon-cyan" />
                  <span>Screening Performance Benchmark</span>
                </CardTitle>
                <CardDescription>
                  Comparison of legacy fixed limits vs normalized, ratio, and multivariate screens.
                </CardDescription>
              </div>

              <Link
                href="/baseline-screens"
                className="flex shrink-0 items-center space-x-1 text-sm text-silicon-cyan hover:underline"
              >
                <span>Deep Dive</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>

            <div className="pt-2">
              <Table caption="Screening performance benchmark">
                <THead>
                  <Tr>
                    <Th>Screening method</Th>
                    <Th align="right">Flagged</Th>
                    <Th align="right">Caught</Th>
                    <Th align="right">Recall</Th>
                    <Th align="right">False alarms</Th>
                    <Th align="right">LOT12 overkill</Th>
                  </Tr>
                </THead>
                <TBody>
                  {Object.entries(screens).map(([key, s]: [string, any]) => (
                    <Tr key={key}>
                      <Td>{s.name || key}</Td>
                      <Td align="right" numeric>{s.flagged_count?.toLocaleString()}</Td>
                      <Td align="right" numeric className="text-silicon-emerald">{s.true_positives?.toLocaleString()}</Td>
                      <Td align="right" numeric>{s.recall != null ? `${(s.recall * 100).toFixed(1)}%` : "—"}</Td>
                      <Td align="right" numeric className="text-silicon-ruby">{s.false_positives?.toLocaleString()}</Td>
                      <Td align="right" numeric>{s.lot12_overkill ?? "—"}</Td>
                    </Tr>
                  ))}
                  {!hasAnalysis && (
                    <Tr>
                      <Td colSpan={6} className="py-12 text-center text-app-muted">
                        No analysis benchmark loaded. Ingest data and run the pipeline.
                      </Td>
                    </Tr>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Column 3: Optimization Levers Summary */}
        <div className="space-y-4">
          <Card variant="interactive">
            <h3 className="type-label mb-3 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-silicon-cyan" />
              <span>Vector Set Cover</span>
            </h3>
            <div className="flex items-baseline justify-between mb-1">
              <span className="type-numeric text-2xl font-semibold text-app-text">
                {vectorOpt.selected_vector_count ? `${vectorOpt.selected_vector_count} / ${vectorOpt.total_available_vectors}` : "20 / 20"}
              </span>
              <span className="type-numeric text-xs font-semibold text-silicon-emerald">
                {vectorOpt.modeled_fault_coverage_pct ?? 100}% Fault Coverage
              </span>
            </div>
            <p className="text-xs text-app-muted leading-relaxed">
              Greedy set-cover retains all essential vectors covering 2,000 modeled fault sites.
            </p>
            <Link
              href="/vector-optimization"
              className="mt-3 inline-flex items-center space-x-1 text-sm text-silicon-cyan hover:underline"
            >
              <span>Inspect coverage curves</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card variant="interactive">
            <h3 className="type-label mb-3 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-silicon-cyan" />
              <span>Early Settling Prediction</span>
            </h3>
            <div className="flex items-baseline justify-between mb-1">
              <span className="type-numeric text-2xl font-semibold text-app-text">
                {settling.safe_early_termination_pct ? `${settling.safe_early_termination_pct}%` : "—"}
              </span>
              <span className="type-numeric text-xs text-silicon-cyan">
                MAE: {settling.ml_mae_ua ? `${settling.ml_mae_ua} µA` : "—"}
              </span>
            </div>
            <p className="text-xs text-app-muted leading-relaxed">
              Quantile regression on early samples with calibrated repeatability guard-band.
            </p>
            <Link
              href="/settling-prediction"
              className="mt-3 inline-flex items-center space-x-1 text-sm text-silicon-cyan hover:underline"
            >
              <span>View settling intervals</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card variant="interactive">
            <h3 className="type-label mb-3 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-silicon-cyan" />
              <span>Adaptive Testing</span>
            </h3>
            <div className="flex items-baseline justify-between mb-1">
              <span className="type-numeric text-2xl font-semibold text-app-text">
                {adaptive.skip_rate_pct ? `${adaptive.skip_rate_pct}%` : "—"}
              </span>
              <span className="type-numeric text-xs text-silicon-emerald">
                Audit: {adaptive.audit_rate_pct ?? 5}%
              </span>
            </div>
            <p className="text-xs text-app-muted leading-relaxed">
              Dynamic stop-on-first-fail and risk-tiered vector sequencing.
            </p>
            <Link
              href="/adaptive-testing"
              className="mt-3 inline-flex items-center space-x-1 text-sm text-silicon-cyan hover:underline"
            >
              <span>Inspect risk strata</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
