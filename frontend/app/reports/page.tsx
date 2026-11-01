"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Download, Copy, Check, Clock, ShieldCheck, Database } from "lucide-react";
import { fetchAnalyses, fetchAnalysisReport } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { Select } from "@/components/ui/Select";

export default function ReportsPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAnalyses(1)
      .then((runs) => {
        setAnalyses(runs);
        if (runs && runs.length > 0) {
          setSelectedRunId(runs[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      setLoading(true);
      fetchAnalysisReport(selectedRunId)
        .then((md) => {
          setReportMarkdown(md);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedRunId]);

  function handleDownload() {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IDDQ_Optimization_Report_Run${selectedRunId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    if (!reportMarkdown) return;
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Semiconductor Engineering Reports & Audit Lineage"
        subtitle="Downloadable executive summaries, gate qualification records, and reproducible audit logs."
        badge={{
          label: selectedRunId ? `Run #${selectedRunId} Selected` : "Awaiting Run",
          variant: selectedRunId ? "live" : "neutral",
        }}
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={!reportMarkdown}
              icon={copied ? <Check className="w-4 h-4 text-silicon-emerald" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? "Copied!" : "Copy Markdown"}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              disabled={!reportMarkdown}
              icon={<Download className="w-4 h-4" />}
            >
              Download Report (.md)
            </Button>
          </div>
        }
      />

      {/* Run Selector */}
      {analyses.length > 1 && (
        <Card>
          <CardContent className="p-3">
            <Select
              label="Analysis run"
              aria-label="Select analysis run"
              value={selectedRunId || ""}
              onChange={(e) => setSelectedRunId(Number(e.target.value))}
              className="max-w-xl"
            >
              {analyses.map((run) => (
                <option key={run.id} value={run.id}>
                  Run #{run.id}: {run.name} ({new Date(run.created_at).toLocaleDateString()})
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Markdown Document Preview */}
      <Card>
        <CardHeader className="py-3 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-silicon-ruby/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-silicon-amber/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-silicon-emerald/60" />
            <span className="text-xs text-[var(--text-muted)] ml-2">
              {selectedRunId ? `IDDQ_Optimization_Report_Run${selectedRunId}.md` : "Report Viewer"}
            </span>
          </div>
          {reportMarkdown && (
            <span className="text-[11px] text-silicon-cyan">
              UTF-8 Markdown Document
            </span>
          )}
        </CardHeader>

        <CardContent className="p-6">
          {initialLoading || loading ? (
            <div className="p-8 space-y-4">
              <SkeletonLoader variant="rect" className="h-8 w-1/3" />
              <SkeletonLoader variant="rect" className="h-4 w-full" />
              <SkeletonLoader variant="rect" className="h-4 w-5/6" />
              <SkeletonLoader variant="rect" className="h-48 w-full" />
            </div>
          ) : !reportMarkdown ? (
            <div className="py-12">
              <EmptyState
                icon={<FileText className="w-8 h-8 text-[var(--text-muted)]" />}
                title="No Engineering Report Generated"
                description="Engineering audit reports are compiled when an optimization run completes. Execute an analysis run to generate comprehensive markdown audit documentation."
                action={
                  <Link href="/datasets">
                    <Button variant="primary" size="sm" icon={<Database className="w-4 h-4" />}>
                      Go to Datasets & Run Analysis
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap overflow-x-auto max-h-[700px] bg-[var(--bg-canvas)] p-6 rounded-lg border border-[var(--border-subtle)]">
              {reportMarkdown}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
