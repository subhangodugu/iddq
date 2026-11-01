"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Lock, Database } from "lucide-react";
import { fetchAnalyses } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function ValidationGatesPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAnalyses(1)
      .then((runs) => {
        if (runs && runs.length > 0) setAnalysis(runs[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const gates = analysis?.results_json?.gates?.gates || [];
  const overall = analysis?.results_json?.gates?.overall_status || "SHADOW_QUALIFIED";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Formal Release Gates & Safety Governance Controls"
        subtitle="Mandatory gate criteria defined in Section 8.1 of the Technical Specification. Until Gate 3 passes, reduced test flows operate strictly in shadow simulation mode."
        badge={{
          label: `Authorization: ${overall}`,
          variant: overall.includes("QUALIFIED") || overall.includes("PASS") ? "live" : "warning",
        }}
      />

      {loading ? (
        <div className="space-y-6">
          <SkeletonLoader variant="card" className="h-48" />
          <SkeletonLoader variant="card" className="h-48" />
          <SkeletonLoader variant="card" className="h-48" />
        </div>
      ) : gates.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<ShieldCheck className="w-10 h-10 text-[var(--text-muted)]" />}
              title="No Validation Gate Evaluations Recorded"
              description="Release gates are formally evaluated during the analysis pipeline execution. Upload datasets and run optimization to verify Gate 1 (Model Performance), Gate 2 (Process Shift Safety), and Gate 3 (Production Readiness)."
              action={
                <Link href="/datasets">
                  <Button variant="primary" size="sm" icon={<Database className="w-4 h-4" />}>
                    Go to Datasets & Run Analysis
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        /* The Three Principal Release Gates */
        <div className="space-y-6">
          {gates.map((g: any) => {
            const isPassed = g.status === "PASSED";
            return (
              <Card
                key={g.gate_id}
                className={`transition-all ${
                  isPassed ? "border-[var(--border-subtle)]" : "border-silicon-ruby/50 shadow-red-500/5"
                }`}
              >
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border-subtle)] gap-3">
                  <div className="flex items-center space-x-3">
                    {isPassed ? (
                      <CheckCircle2 className="w-6 h-6 text-silicon-emerald shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-silicon-ruby shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-base font-bold tracking-tight">{g.name}</CardTitle>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface)] text-silicon-cyan border border-[var(--border-subtle)]">
                          {g.gate_id}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{g.description}</p>
                    </div>
                  </div>

                  <StatusBadge
                    status={isPassed ? "pass" : "defect"}
                    label={`STATUS: ${g.status}`}
                  />
                </CardHeader>

                {/* Individual Checks Table */}
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full type-numeric text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 text-[var(--text-muted)]">
                          <th className="py-3 px-4 w-1/3">Evaluation Requirement</th>
                          <th className="py-3 px-4 w-1/6 text-center">Result</th>
                          <th className="py-3 px-4 w-1/2">Audit Evidence & Criteria</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {g.checks?.map((c: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[var(--bg-surface)]/60 transition-colors">
                            <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{c.item}</td>
                            <td className="py-3 px-4 text-center">
                              <StatusBadge
                                status={c.passed ? "pass" : "defect"}
                                label={c.passed ? "PASS" : "FAIL"}
                              />
                            </td>
                            <td className="py-3 px-4 text-[var(--text-secondary)]">{c.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Production Safety Controls */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
          <CardTitle className="text-base font-bold flex items-center space-x-2">
            <Lock className="w-5 h-5 text-silicon-cyan" />
            <span>Automated Safety Guard-Bands & Fallback Policy</span>
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Engineered circuit breakers to prevent erroneous escapes during unexpected fab shifts.
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
              <div className="text-silicon-amber font-bold uppercase flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-silicon-amber" />
                <span>Full-Test Fallback Triggers</span>
              </div>
              <ul className="text-[var(--text-secondary)] space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
                <li>Any missing, corrupted, or NaN pre-IDDQ parametric values.</li>
                <li>Spatial coordinates outside valid circular wafer boundaries.</li>
                <li>Transient settling interval width exceeding 5.0 µA repeatability.</li>
                <li>Lot Population Stability Index (PSI) exceeding 0.25 alert limit.</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
              <div className="text-silicon-emerald font-bold uppercase flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-silicon-emerald" />
                <span>Change Control & Model Governance</span>
              </div>
              <ul className="text-[var(--text-secondary)] space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
                <li>Every model trained is stamped with Git hash and SHA-256 data checksum.</li>
                <li>Rollback capability allows instant reversion to previous baseline model.</li>
                <li>Decisions logged per die in datalog format compatible with STDF records.</li>
                <li>Customer ECO approval required prior to live production activation.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
