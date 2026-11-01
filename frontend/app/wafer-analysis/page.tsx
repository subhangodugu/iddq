"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Disc,
  AlertTriangle,
  ShieldAlert,
  BarChart2,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  Cpu
} from "lucide-react";
import { fetchWaferLots, fetchWaferDetails, fetchDriftTimeline } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useChartTheme } from "@/components/ui/ChartFrame";
import { Select } from "@/components/ui/Select";

export default function WaferAnalysisPage() {
  const chart = useChartTheme();
  const isDark = chart.isDark;

  const [lots, setLots] = useState<string[]>([]);
  const [selectedLot, setSelectedLot] = useState<string>("LOT01");
  const [selectedWafer, setSelectedWafer] = useState<number>(1);
  const [waferData, setWaferData] = useState<any>(null);
  const [loadingWafer, setLoadingWafer] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<string>("status");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [defectFilter, setDefectFilter] = useState<string>("ALL");
  const [hoveredDie, setHoveredDie] = useState<any>(null);
  const [driftTimeline, setDriftTimeline] = useState<any[]>([]);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    fetchWaferLots()
      .then((res) => {
        if (res && res.lots && res.lots.length > 0) {
          setLots(res.lots);
          setSelectedLot(res.lots[0]);
        }
      })
      .catch(console.error);

    fetchDriftTimeline()
      .then((res) => {
        if (res && res.lot_drift_timeline) {
          setDriftTimeline(res.lot_drift_timeline);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedLot && selectedWafer) {
      setLoadingWafer(true);
      fetchWaferDetails(selectedLot, selectedWafer)
        .then((data) => {
          setWaferData(data);
        })
        .catch(console.error)
        .finally(() => setLoadingWafer(false));
    }
  }, [selectedLot, selectedWafer]);

  function getDieStatus(die: any): "FAIL" | "SUSPECT" | "PASS" {
    if (die.true_defect === 1 || die.fixed_limit_fail === 1 || Math.abs(die.leakage_norm_residual || 0) > 3.5) {
      return "FAIL";
    }
    if ((die.core_current_ratio || 1.0) > 1.25 || Math.abs(die.leakage_norm_residual || 0) > 2.0) {
      return "SUSPECT";
    }
    return "PASS";
  }

  function getDieColor(die: any) {
    if (colorMode === "status") {
      const st = getDieStatus(die);
      if (st === "FAIL") return "#EF4444"; // Red
      if (st === "SUSPECT") return "#F59E0B"; // Amber
      return "#10B981"; // Emerald
    }
    if (colorMode === "ground_truth") {
      return die.true_defect === 1 ? "#EF4444" : isDark ? "#1E293B" : "#CBD5E1";
    }
    if (colorMode === "fixed_limit") {
      return die.fixed_limit_fail === 1 ? "#EF4444" : "#10B981";
    }
    if (colorMode === "norm_res") {
      const res = Math.abs(die.leakage_norm_residual || 0);
      if (res > 3.0) return "#EF4444";
      if (res > 2.0) return "#F59E0B";
      if (res > 1.0) return "#38BDF8";
      return "#10B981";
    }
    // Default: core_median
    const val = die.core_median_ua || 150;
    if (val > 350) return "#EF4444";
    if (val > 250) return "#F59E0B";
    if (val > 180) return "#38BDF8";
    return "#10B981";
  }

  // Filter dies
  const allDies = waferData?.dies || [];
  const filteredDies = allDies.filter((d: any) => {
    const st = getDieStatus(d);
    if (statusFilter !== "ALL" && st !== statusFilter) return false;
    if (defectFilter !== "ALL") {
      const dType = d.defect_type || "none";
      if (dType.toLowerCase() !== defectFilter.toLowerCase()) return false;
    }
    return true;
  });

  const siteStats = waferData?.site_stats || {};
  const siteChartData = Object.entries(siteStats).map(([sKey, sVal]: [string, any]) => ({
    site: sKey.replace("site_", "Site "),
    median_ua: sVal.median_ua,
    mean_ua: sVal.mean_ua,
    count: sVal.count,
  }));

  function handleExportCsv() {
    if (allDies.length === 0) return;
    const headers = [
      "die_uid",
      "lot_id",
      "wafer_id",
      "die_x",
      "die_y",
      "status",
      "core_median_ua",
      "core_max_ua",
      "core_current_ratio",
      "leakage_norm_residual",
      "fixed_limit_fail",
      "true_defect",
      "defect_type"
    ];
    const rows = allDies.map((d: any) => [
      d.die_uid,
      selectedLot,
      selectedWafer,
      d.die_x,
      d.die_y,
      getDieStatus(d),
      d.core_median_ua,
      d.core_max_ua,
      d.core_current_ratio,
      d.leakage_norm_residual,
      d.fixed_limit_fail,
      d.true_defect || 0,
      d.defect_type || "none"
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wafer_map_${selectedLot}_W${selectedWafer}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Interactive Wafer Spatial Intelligence, Zoom/Pan & Lot Drift"
        subtitle="28×28 circular wafer coordinate grid mapping, parallel test site bias inspection, and cross-lot Population Stability Index drift tracking."
        badge={{
          label: `${selectedLot} — Wafer ${selectedWafer}`,
          variant: "live",
        }}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={allDies.length === 0}
            icon={<Download className="w-3.5 h-3.5 text-silicon-cyan" />}
          >
            Export Wafer CSV
          </Button>
        }
      />

      {/* Controls Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Lot" aria-label="Select Lot" value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)}>
              {lots.map((l) => (
                <option key={l} value={l}>
                  {l} {l === "LOT12" ? "(shift lot)" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Wafer"
              aria-label="Select Wafer"
              value={selectedWafer}
              onChange={(e) => setSelectedWafer(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  Wafer {w}
                </option>
              ))}
            </Select>
            <Select label="Status" aria-label="Filter by Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="FAIL">Fail only</option>
              <option value="SUSPECT">Suspect only</option>
              <option value="PASS">Pass only</option>
            </Select>
            <Select label="Color" aria-label="Select Color Metric" value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
              <option value="status">Pass / fail / suspect</option>
              <option value="core_median">Core median IDDQ</option>
              <option value="norm_res">Normalized residual</option>
              <option value="fixed_limit">Legacy 450 µA screen</option>
              <option value="ground_truth">Ground truth defects</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Wafer Map and Die Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wafer SVG Canvas */}
        <Card className="lg:col-span-2 flex flex-col items-center justify-center relative p-6">
          <div className="w-full flex flex-wrap items-center justify-between text-xs text-[var(--text-muted)] mb-4 gap-2">
            <span>
              {selectedLot} / Wafer {selectedWafer} ({filteredDies.length} of {allDies.length} Die Displayed)
            </span>
            <div className="flex items-center space-x-4">
              {/* Zoom & Pan Toolbar */}
              <div className="flex items-center space-x-1 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-lg p-1">
                <button
                  onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-app-secondary hover:bg-app-cardHover hover:text-app-text"
                  title="Zoom In"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-app-secondary hover:bg-app-cardHover hover:text-app-text"
                  title="Zoom Out"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="p-1 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded"
                  title="Reset Zoom & Pan"
                  aria-label="Reset zoom and pan"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-silicon-emerald shadow-sm" />
                  <span>Pass</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-silicon-amber shadow-sm" />
                  <span>Suspect</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-silicon-ruby shadow-sm" />
                  <span>Fail</span>
                </span>
              </div>
            </div>
          </div>

          {/* Wafer SVG Container with Zoom & Pan */}
          <div
            className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing border border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-canvas)] shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Outer Circular Notch & Wafer Rim */}
            <div className="absolute inset-4 rounded-full border-2 border-[var(--border-subtle)] pointer-events-none" />
            <div className="absolute bottom-5 w-6 h-1.5 bg-[var(--border-subtle)] rounded-full pointer-events-none" />

            {loadingWafer ? (
              <div className="text-center text-xs text-[var(--text-muted)]">
                Loading wafer map...
              </div>
            ) : allDies.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-muted)] p-6">
                No die data available for this lot/wafer. Ingest dataset to render wafer.
              </div>
            ) : (
              <svg
                viewBox="-1 -1 30 30"
                className="w-[310px] h-[310px] sm:w-[450px] sm:h-[450px] transition-transform duration-75 select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / (15 * zoom)}px, ${pan.y / (15 * zoom)}px)`,
                }}
              >
                {filteredDies.map((d: any) => {
                  const color = getDieColor(d);
                  const isHovered = hoveredDie?.die_uid === d.die_uid;
                  return (
                    <rect
                      key={d.die_uid}
                      x={d.die_x}
                      y={d.die_y}
                      width={0.88}
                      height={0.88}
                      rx={0.12}
                      fill={color}
                      className="transition-colors cursor-pointer"
                      stroke={isHovered ? "#38BDF8" : "none"}
                      strokeWidth={isHovered ? 0.15 : 0}
                      onMouseEnter={() => setHoveredDie(d)}
                      onClick={() => {
                        window.location.href = `/die-analysis?uid=${d.die_uid}`;
                      }}
                    />
                  );
                })}
              </svg>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-3">
            Click die to open full defect diagnostic workspace. Drag to pan wafer canvas.
          </div>
        </Card>

        {/* Die Inspection Sidebar & Site Bias */}
        <div className="space-y-6">
          {/* Hovered Die Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
              <CardTitle className="type-label flex items-center space-x-2">
                <Layers className="w-4 h-4 text-silicon-cyan" />
                <span>Die Coordinate Probe</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4">
              {hoveredDie ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)]">UID:</span>
                    <span className="text-silicon-cyan font-bold">{hoveredDie.die_uid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Coordinates (X, Y):</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      ({hoveredDie.die_x}, {hoveredDie.die_y})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Status Classification:</span>
                    <StatusBadge
                      status={
                        getDieStatus(hoveredDie) === "FAIL"
                          ? "defect"
                          : getDieStatus(hoveredDie) === "SUSPECT"
                          ? "warning"
                          : "pass"
                      }
                      label={getDieStatus(hoveredDie)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Core Median IDDQ:</span>
                    <span className="text-[var(--text-primary)] font-semibold">{hoveredDie.core_median_ua?.toFixed(1)} µA</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Max/Min Ratio:</span>
                    <span className="text-[var(--text-primary)]">{hoveredDie.core_current_ratio?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Normalized Residual:</span>
                    <span className="text-[var(--text-primary)]">
                      {hoveredDie.leakage_norm_residual ? `${hoveredDie.leakage_norm_residual.toFixed(2)} σ` : "0.0 σ"}
                    </span>
                  </div>
                  {hoveredDie.defect_type && hoveredDie.defect_type !== "none" && (
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Ground-Truth Defect:</span>
                      <span className="text-silicon-ruby font-bold uppercase">{hoveredDie.defect_type}</span>
                    </div>
                  )}
                  <div className="pt-3">
                    <Link href={`/die-analysis?uid=${hoveredDie.die_uid}`} className="block">
                      <Button variant="primary" size="sm" className="w-full">
                        Inspect Full Die Diagnosis →
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] py-8 text-center">
                  Hover over any die on the 28×28 wafer map to inspect spatial coordinates, IDDQ measurements, and defect diagnosis.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tester Site Bias Chart */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
              <CardTitle className="type-label flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-silicon-cyan" />
                <span>4-Site Parallel Tester Distribution</span>
              </CardTitle>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Detecting probe contact resistance elevation or site-specific measurement bias.
              </p>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="site" stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} />
                    <YAxis stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} unit=" µA" />
                    <Tooltip
                      contentStyle={chart.tooltipStyle}
                    />
                    <Bar dataKey="median_ua" name="Median IDDQ" fill="#00D2FF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mean_ua" name="Mean IDDQ" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lot Drift Timeline (Population Stability Index) */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <CardTitle className="text-base font-bold flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-silicon-amber" />
              <span>Lot-to-Lot Process Shift Tracking (Population Stability Index)</span>
            </CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Quantifies leakage distribution shifts across manufacturing lots. Thresholds: PSI &lt; 0.10 (Stable), 0.10–0.25 (Moderate), &gt; 0.25 (Process Shift Alert).
            </p>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Reference Baseline: <span className="text-silicon-cyan font-bold">LOT01</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full type-numeric text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 text-[var(--text-muted)]">
                  <th className="py-3 px-4">Lot ID</th>
                  <th className="py-3 px-4 text-right">Median</th>
                  <th className="py-3 px-4 text-right">P05</th>
                  <th className="py-3 px-4 text-right">P95</th>
                  <th className="py-3 px-4 text-right">Shift vs LOT01</th>
                  <th className="py-3 px-4 text-right">PSI Score</th>
                  <th className="py-3 px-4 text-center">Stability Status</th>
                  <th className="py-3 px-4">Adaptive Action Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {driftTimeline.map((lt: any) => {
                  const psi = typeof lt.psi === "number" ? lt.psi : lt.psi_vs_reference;
                  const median = lt.median_ua ?? lt.median_leakage_ua;
                  const p05 = lt.p05_ua;
                  const p95 = lt.p95_ua;
                  const shift = lt.shift_pct_vs_ref;
                  const isShift = lt.status === "PROCESS_SHIFT_ALERT" || lt.drift_alert || (typeof psi === "number" && psi >= 0.25);
                  const isModerate = lt.status === "MODERATE_SHIFT" || (typeof psi === "number" && psi >= 0.10 && psi < 0.25);
                  const ua = (value: number | undefined) => (typeof value === "number" ? `${value.toFixed(1)} µA` : "—");
                  return (
                    <tr
                      key={lt.lot_id}
                      className={`hover:bg-[var(--bg-surface)]/60 transition-colors ${
                        isShift ? "bg-silicon-ruby/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {lt.lot_id} {lt.lot_id === "LOT12" ? "(Process Shift Lot)" : ""}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{ua(median)}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-muted)]">{ua(p05)}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{ua(p95)}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                        {typeof shift === "number" ? `${shift > 0 ? "+" : ""}${shift.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-silicon-cyan">
                        {typeof psi === "number" ? psi.toFixed(3) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge
                          status={isShift ? "defect" : isModerate ? "warning" : "pass"}
                          label={isShift ? "CRITICAL SHIFT" : isModerate ? "MODERATE SHIFT" : "STABLE"}
                        />
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] text-[11px]">
                        {isShift
                          ? "Automated fallback: Revert 100% of die to Full IDDQ Flow"
                          : "Normal adaptive testing & reduced flow permitted"}
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
  );
}
