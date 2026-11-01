"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  Microscope,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Zap,
  Info,
  Layers,
  Cpu,
  BarChart3
} from "lucide-react";
import { fetchDefects, fetchDefectsSummary, fetchWaferLots } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";

export default function DefectsPage() {
  const [defectsData, setDefectsData] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [lots, setLots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLot, setSelectedLot] = useState<string>("");
  const [selectedWafer, setSelectedWafer] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const limit = 25;

  useEffect(() => {
    fetchWaferLots().then((res) => {
      if (res && res.lots) setLots(res.lots);
    }).catch(console.error);
    fetchDefectsSummary().then((s) => setSummary(s)).catch(console.error);
  }, []);

  useEffect(() => {
    loadDefects();
  }, [selectedLot, selectedWafer, selectedMethod, selectedStatus, selectedClass, page]);

  async function loadDefects() {
    setLoading(true);
    try {
      const res = await fetchDefects({
        lot_id: selectedLot || undefined,
        wafer_id: selectedWafer ? Number(selectedWafer) : undefined,
        detection_method: selectedMethod || undefined,
        status_category: selectedStatus || undefined,
        predicted_defect_class: selectedClass || undefined,
        page,
        limit,
      });
      setDefectsData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCsv() {
    const url = `http://127.0.0.1:8000/api/defects/export${selectedLot ? `?lot_id=${selectedLot}` : ""}`;
    window.open(url, "_blank");
  }

  function getStatusBadgeType(status: string): "defect" | "live" | "warning" | "neutral" | "outlier" {
    switch (status) {
      case "CONFIRMED_DEFECT":
        return "defect";
      case "MODEL_PREDICTED":
        return "live";
      case "STATISTICAL_ANOMALY":
        return "warning";
      case "UNVERIFIED_SUSPECT":
        return "outlier";
      default:
        return "neutral";
    }
  }

  const items = defectsData?.items || [];
  const totalCount = defectsData?.total_count || 0;
  const totalPages = defectsData?.total_pages || 1;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Real Defect Detection & Taxonomy Workspace"
        subtitle="Traceable multi-screen defect detections, distinguishing Confirmed Defects, Model Predictions, Statistical Anomalies, and Suspects."
        badge={{
          label: `${totalCount.toLocaleString()} Defect Events`,
          variant: totalCount > 0 ? "defect" : "neutral",
        }}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download className="w-4 h-4 text-silicon-cyan" />}
          >
            Export Detected CSV
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Confirmed Defects"
          value={summary?.by_status_category?.CONFIRMED_DEFECT ?? (loading ? "..." : 0)}
          subtitle="Ground-truth verified"
          status="defect"
          icon={<ShieldAlert className="w-5 h-5 text-silicon-ruby" />}
        />
        <KpiCard
          title="Model-Predicted"
          value={summary?.by_status_category?.MODEL_PREDICTED ?? (loading ? "..." : 0)}
          subtitle="GBDT risk > 0.65 or > 3.5σ"
          status="live"
          icon={<Zap className="w-5 h-5 text-silicon-cyan" />}
        />
        <KpiCard
          title="Statistical Anomalies"
          value={summary?.by_status_category?.STATISTICAL_ANOMALY ?? (loading ? "..." : 0)}
          subtitle="Mahalanobis / Fixed limit"
          status="warning"
          icon={<AlertTriangle className="w-5 h-5 text-silicon-amber" />}
        />
        <KpiCard
          title="Unverified Suspects"
          value={summary?.by_status_category?.UNVERIFIED_SUSPECT ?? (loading ? "..." : 0)}
          subtitle="Marginal step / ratio elevated"
          status="neutral"
          icon={<Info className="w-5 h-5 text-[var(--text-muted)]" />}
        />
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Select
              label="Lot"
              aria-label="Filter by Lot"
              value={selectedLot}
              onChange={(e) => {
                setSelectedLot(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All lots</option>
              {lots.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
            <Select
              label="Wafer"
              aria-label="Filter by Wafer"
              value={selectedWafer}
              onChange={(e) => {
                setSelectedWafer(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All wafers</option>
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  Wafer {w}
                </option>
              ))}
            </Select>
            <Select
              label="Method"
              aria-label="Filter by Method"
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All methods</option>
              <option value="current_ratio">Current ratio</option>
              <option value="normalized_residual">Normalized residual</option>
              <option value="delta_iddq">Delta-IDDQ</option>
              <option value="fixed_limit">Legacy fixed limit</option>
              <option value="supervised_gbdt">Supervised GBDT</option>
            </Select>
            <Select
              label="Status"
              aria-label="Filter by Status Category"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="CONFIRMED_DEFECT">Confirmed defect</option>
              <option value="MODEL_PREDICTED">Model predicted</option>
              <option value="STATISTICAL_ANOMALY">Statistical anomaly</option>
              <option value="UNVERIFIED_SUSPECT">Unverified suspect</option>
            </Select>
            <Select
              label="Class"
              aria-label="Filter by Defect Taxonomy"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All classes</option>
              <option value="bridge">Bridge</option>
              <option value="gate_oxide_short">Gate-oxide short</option>
              <option value="open_floating">Open / floating</option>
              <option value="weak_latent">Weak / latent</option>
            </Select>

            {(selectedLot || selectedWafer || selectedMethod || selectedStatus || selectedClass) && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSelectedLot("");
                  setSelectedWafer("");
                  setSelectedMethod("");
                  setSelectedStatus("");
                  setSelectedClass("");
                  setPage(1);
                }}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Defects Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-silicon-cyan" />
              <span>Die Screening Traceability Log</span>
            </CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Showing <span className="font-semibold text-[var(--text-primary)]">{items.length}</span> of{" "}
              <span className="font-semibold text-[var(--text-primary)]">{totalCount.toLocaleString()}</span> detected defect instances
            </p>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center space-x-2 text-sm text-app-muted">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-silicon-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[var(--text-muted)] px-2">
              Page <span className="font-bold text-[var(--text-primary)]">{page}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-silicon-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <SkeletonLoader variant="rect" className="h-10 w-full" />
              <SkeletonLoader variant="rect" className="h-10 w-full" />
              <SkeletonLoader variant="rect" className="h-10 w-full" />
              <SkeletonLoader variant="rect" className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<AlertTriangle className="w-8 h-8 text-[var(--text-muted)]" />}
                title="No Defect Records Found"
                description={
                  selectedLot || selectedWafer || selectedMethod || selectedStatus || selectedClass
                    ? "No defects match the selected filter criteria. Try adjusting or clearing your filters."
                    : "No defect detections are currently recorded in the database. Ingest and run baseline screens to identify defects."
                }
                action={
                  (selectedLot || selectedWafer || selectedMethod || selectedStatus || selectedClass) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLot("");
                        setSelectedWafer("");
                        setSelectedMethod("");
                        setSelectedStatus("");
                        setSelectedClass("");
                        setPage(1);
                      }}
                    >
                      Clear All Filters
                    </Button>
                  ) : (
                    <Link href="/datasets">
                      <Button variant="primary" size="sm">
                        Go to Data Ingestion
                      </Button>
                    </Link>
                  )
                }
              />
            </div>
          ) : (
            <Table caption="Detected defects">
              <THead>
                <Tr>
                  <Th>Die UID</Th>
                  <Th>Lot / wafer</Th>
                  <Th>Status</Th>
                  <Th>Class</Th>
                  <Th>Method</Th>
                  <Th align="right">IDDQ</Th>
                  <Th align="right">Threshold</Th>
                  <Th align="right">Risk</Th>
                  <Th>Explanation</Th>
                  <Th align="center">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((d: any) => (
                  <Tr key={d.id}>
                    <Td numeric className="text-silicon-cyan">{d.die_uid}</Td>
                    <Td numeric className="text-app-secondary">
                      {d.lot_id} / W{d.wafer_id} / ({d.die_x}, {d.die_y})
                    </Td>
                    <Td>
                      <StatusBadge
                        status={getStatusBadgeType(d.status_category)}
                        label={d.status_category?.replace(/_/g, " ")}
                      />
                    </Td>
                    <Td>{d.predicted_defect_class}</Td>
                    <Td className="capitalize text-app-muted">{d.detection_method?.replace(/_/g, " ")}</Td>
                    <Td align="right" numeric>{d.measured_iddq_ua} µA</Td>
                    <Td align="right" numeric className="text-app-muted">{d.applicable_threshold}</Td>
                    <Td align="right" numeric className="text-silicon-emerald">{d.risk_score}</Td>
                    <Td className="max-w-xs truncate text-app-muted" title={d.detection_explanation}>
                      {d.detection_explanation}
                    </Td>
                    <Td align="center">
                      <Link href={`/die-analysis?uid=${d.die_uid}`}>
                        <Button variant="outline" size="xs" icon={<Microscope className="w-3.5 h-3.5 text-silicon-cyan" />}>
                          Diagnose
                        </Button>
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
