"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Microscope,
  Search,
  AlertCircle,
  CheckCircle2,
  Activity,
  Layers,
  ArrowRightLeft,
  Clock,
  Zap,
  TrendingDown,
  Info,
  Cpu
} from "lucide-react";
import { searchDie, fetchDieDiagnosis, compareDies } from "@/lib/api";
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
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useChartTheme } from "@/components/ui/ChartFrame";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/Field";

function DieDiagnosisContent() {
  const searchParams = useSearchParams();
  const initialUid = searchParams.get("uid") || "L01W01X10Y01";
  const { toast } = useToast();
  const chart = useChartTheme();

  const [searchQuery, setSearchQuery] = useState(initialUid.slice(0, 7) || "L01W01X");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDieUid, setSelectedDieUid] = useState<string>(initialUid);
  const [dieData, setDieData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Transient vector selector
  const [selectedTransVecIdx, setSelectedTransVecIdx] = useState<number>(0);

  // Die-to-Die comparison state
  const [compareUid, setCompareUid] = useState<string>("");
  const [compareResult, setCompareResult] = useState<any | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  useEffect(() => {
    handleSearch();
  }, []);

  useEffect(() => {
    if (selectedDieUid) {
      loadDieDetail(selectedDieUid);
    }
  }, [selectedDieUid]);

  async function handleSearch() {
    try {
      const res = await searchDie(searchQuery, undefined, undefined, 20);
      const list = Array.isArray(res) ? res : [];
      setSearchResults(list);
      if (list.length > 0 && (!selectedDieUid || !list.some((d: any) => d.die_uid === selectedDieUid))) {
        setSelectedDieUid(list[0].die_uid);
      }
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    }
  }

  async function loadDieDetail(uid: string) {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await fetchDieDiagnosis(uid);
      setDieData(data);
      setSelectedTransVecIdx(0);
      setCompareResult(null);
    } catch (e) {
      console.error(e);
      setDieData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunCompare() {
    if (!compareUid.trim() || !dieData) return;
    setComparing(true);
    try {
      const res = await compareDies(dieData.die_uid, compareUid.trim());
      setCompareResult(res);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Comparison failed.", "error");
    } finally {
      setComparing(false);
    }
  }

  const diag = dieData?.diagnosis || {};
  const metrics = dieData?.metrics || {};
  const flags = dieData?.flags || {};
  const gt = dieData?.ground_truth_evaluation_only || {};
  const transWaveforms = dieData?.transient_waveforms || [];
  const currentTrans = transWaveforms[selectedTransVecIdx] || null;

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


  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <PageHeader
        title="Die-Level Defect Diagnosis, Waveforms & Comparison Workspace"
        subtitle="Search individual die by UID or coordinates, inspect vector current step curves, analyze high-speed transient waveforms, and cross-reference physical defect hypotheses."
        badge={{
          label: selectedDieUid ? `Active: ${selectedDieUid}` : "Awaiting Selection",
          variant: dieData ? "live" : "neutral",
        }}
      />

      {/* Search Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-app-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by die UID, for example L03W04X18Y09"
                aria-label="Search die UID"
                className="h-10 w-full rounded-xl border border-app-border bg-app-bg pl-9 pr-3 text-sm text-app-text placeholder:text-app-subtle"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSearch}
              icon={<Search className="w-3.5 h-3.5" />}
            >
              Search Die
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search Results List */}
        <div className="lg:col-span-1">
          <Card className="max-h-[750px] flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-[var(--border-subtle)]">
              <CardTitle className="type-label">
                Matching Die Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 overflow-y-auto space-y-2 flex-1">
              {Array.isArray(searchResults) && searchResults.length > 0 ? (
                searchResults.map((d) => {
                  const isSelected = d.die_uid === selectedDieUid;
                  const isDefect = d.true_defect === 1;
                  return (
                    <button
                      key={d.die_uid}
                      onClick={() => setSelectedDieUid(d.die_uid)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs  transition-all flex items-center justify-between border ${
                        isSelected
                          ? "bg-silicon-blue/15 border-silicon-cyan text-silicon-cyan font-semibold shadow-sm"
                          : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-silicon-cyan/50"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{d.die_uid}</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          Ratio: {d.core_current_ratio?.toFixed(2)} | Med: {d.core_median_ua?.toFixed(1)} µA
                        </div>
                      </div>
                      {isDefect && (
                        <StatusBadge status="defect" label="DEFECT" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-xs text-[var(--text-muted)] py-8 text-center">
                  {loading ? "Searching die records..." : "No matching die records found."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Die Detail Investigation View */}
        <div className="lg:col-span-3 space-y-6">
          {loading && (
            <Card>
              <CardContent className="p-12 space-y-4">
                <SkeletonLoader variant="rect" className="h-20 w-full" />
                <SkeletonLoader variant="card" className="h-64" />
              </CardContent>
            </Card>
          )}

          {!dieData && !loading && (
            <Card>
              <CardContent className="p-12">
                <EmptyState
                  icon={<AlertCircle className="w-10 h-10 text-[var(--text-muted)]" />}
                  title="No Die Data Available"
                  description="No die record was found for this UID. Please verify your search term or load real datasets from the Datasets workspace."
                />
              </CardContent>
            </Card>
          )}

          {dieData && !loading && (
            <>
              {/* Die Identity & Hypothesis Card */}
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border-subtle)] gap-3">
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Die Identification</div>
                    <div className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight flex flex-wrap items-center gap-2 mt-1">
                      <span>{dieData.die_uid}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {dieData.lot_id} / Wafer {dieData.wafer_id} / ({dieData.die_x}, {dieData.die_y})
                      </span>
                      <StatusBadge
                        status={getStatusBadgeType(dieData.status_category)}
                        label={dieData.status_category?.replace(/_/g, " ")}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-[var(--text-muted)]">Tester / Site:</span>
                    <span className="text-silicon-cyan font-semibold">
                      {dieData.tester_id} / Site {dieData.site_id}
                    </span>
                    <span className="text-[var(--text-muted)] ml-2">Temp:</span>
                    <span className="text-[var(--text-primary)] font-bold">{dieData.test_temp_c}°C</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Engineering Hypothesis Box */}
                  <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-silicon-cyan/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="type-label text-silicon-cyan font-semibold">
                        Suspected Physical Defect Hypothesis
                      </div>
                      <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{diag.suspected_defect_type}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{diag.recommended_next_step}</div>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div className="text-[var(--text-muted)]">Model Confidence:</div>
                      <div className="text-silicon-emerald font-bold text-sm">{diag.confidence}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">{diag.evidence}</div>
                    </div>
                  </div>

                  {/* Ground Truth Box (Evaluation Only) */}
                  <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs flex items-center justify-between text-[var(--text-muted)]">
                    <span>
                      Offline Ground Truth:{" "}
                      <strong className={gt.true_defect ? "text-silicon-ruby font-bold" : "text-silicon-emerald font-bold"}>
                        {gt.actual_defect_type?.toUpperCase()}
                      </strong>{" "}
                      {gt.defect_current_ua > 0 && `(+${gt.defect_current_ua} µA)`}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] italic">For offline validation & escape auditing only</span>
                  </div>
                </CardContent>
              </Card>

              {/* Vector Signature Profile Curve */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                  <div>
                    <CardTitle className="text-base font-bold">Vector-by-Vector Current Signature Profile</CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Comparing measured die IDDQ against nominal wafer median reference across 20 core vectors.
                    </p>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Ratio: <span className="text-silicon-cyan font-bold">{metrics.core_current_ratio}</span> | Max Delta:{" "}
                    <span className="text-[var(--text-primary)] font-bold">{metrics.max_delta_iddq_ua} µA</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dieData.vector_profile_chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                        <XAxis dataKey="vector" stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} />
                        <YAxis stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} unit=" µA" />
                        <Tooltip
                          contentStyle={chart.tooltipStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Line
                          type="monotone"
                          dataKey="die_current_ua"
                          name="Measured Die Current"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="wafer_median_ua"
                          name="Wafer Median Reference"
                          stroke="#00D2FF"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Real Transient Waveform Visualization */}
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-silicon-cyan" />
                      <span>Actual Transient Response Waveform (Current vs Time)</span>
                    </CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      High-speed early current samples (0.1 ms intervals) from characterization dataset.
                    </p>
                  </div>

                  {dieData.has_transient_characterization ? (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-[var(--text-muted)]">Vector:</span>
                      <select
                        aria-label="Select transient vector"
                        value={selectedTransVecIdx}
                        onChange={(e) => setSelectedTransVecIdx(Number(e.target.value))}
                        className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-silicon-cyan rounded px-2 py-1"
                      >
                        {transWaveforms.map((w: any, idx: number) => (
                          <option key={idx} value={idx}>
                            {w.vector_id} ({w.rail})
                          </option>
                        ))}
                      </select>
                      <span className="text-[var(--text-muted)] ml-2">Settled Target:</span>
                      <span className="text-silicon-emerald font-bold">{currentTrans?.settled_iddq_ua} µA</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">No transient row in dataset</span>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {dieData.has_transient_characterization && currentTrans ? (
                    <div className="space-y-3">
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={currentTrans.time_series}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                            <XAxis
                              dataKey="time_ms"
                              stroke={chart.axis}
                              tick={{ fill: chart.axis, fontSize: 11 }}
                              unit=" ms"
                            />
                            <YAxis stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} unit=" µA" />
                            <Tooltip
                              contentStyle={chart.tooltipStyle}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <ReferenceLine
                              y={currentTrans.settled_iddq_ua}
                              label={{ value: "Settled Target", fill: "#10B981", fontSize: 10 }}
                              stroke="#10B981"
                              strokeDasharray="3 3"
                            />
                            <Line
                              type="monotone"
                              dataKey="die_current_ua"
                              name="Die Transient Current"
                              stroke="#EF4444"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="ref_current_ua"
                              name="Clean Reference Median"
                              stroke="#00D2FF"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-xs text-[var(--text-muted)] bg-[var(--bg-canvas)] p-3 rounded-lg border border-[var(--border-subtle)] gap-2">
                        <span>Full Settling Duration: <strong className="text-[var(--text-primary)]">{currentTrans.full_settle_time_ms} ms</strong></span>
                        <span>Target Settled IDDQ: <strong className="text-silicon-emerald">{currentTrans.settled_iddq_ua} µA</strong></span>
                        <span>Initial Sample @ 0.1ms: <strong className="text-silicon-ruby">{currentTrans.time_series?.[0]?.die_current_ua} µA</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-subtle)]">
                      <Info className="w-5 h-5 mx-auto text-[var(--text-muted)] mb-2" />
                      <span>
                        Transient waveform characterization was not collected for this die. In the benchmark dataset, 1,500 sample dice were characterized on high-speed digitizers (try searching for <span className="text-silicon-cyan font-bold">L03W04X18Y09</span> or <span className="text-silicon-cyan font-bold">L01W01X</span>).
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Die-to-Die Waveform Comparison Tool */}
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center space-x-2">
                      <ArrowRightLeft className="w-4 h-4 text-silicon-cyan" />
                      <span>Die-to-Die Current Waveform Comparison</span>
                    </CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Overlay current signatures between two individual dies to inspect relative elevation and defect patterns.
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <Field
                      label="Compare UID"
                      value={compareUid}
                      onChange={(e) => setCompareUid(e.target.value)}
                      placeholder="L01W01X03Y03"
                      className="w-52"
                    />
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={handleRunCompare}
                      disabled={comparing || !compareUid}
                      loading={comparing}
                    >
                      Compare
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  {compareResult ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-[var(--bg-canvas)] rounded-lg border border-silicon-cyan/30">
                          <div className="text-silicon-cyan font-bold">{compareResult.die1.die_uid} (Primary)</div>
                          <div className="text-[var(--text-muted)] mt-1">Status: <span className="text-[var(--text-primary)]">{compareResult.die1.status_category}</span></div>
                          <div className="text-[var(--text-muted)]">Median: <span className="text-[var(--text-primary)]">{compareResult.die1.metrics?.core_median_ua} µA</span></div>
                          <div className="text-[var(--text-muted)]">Ratio: <span className="text-[var(--text-primary)]">{compareResult.die1.metrics?.core_current_ratio}</span></div>
                        </div>
                        <div className="p-3 bg-[var(--bg-canvas)] rounded-lg border border-silicon-amber/30">
                          <div className="text-silicon-amber font-bold">{compareResult.die2.die_uid} (Comparison)</div>
                          <div className="text-[var(--text-muted)] mt-1">Status: <span className="text-[var(--text-primary)]">{compareResult.die2.status_category}</span></div>
                          <div className="text-[var(--text-muted)]">Median: <span className="text-[var(--text-primary)]">{compareResult.die2.metrics?.core_median_ua} µA</span></div>
                          <div className="text-[var(--text-muted)]">Ratio: <span className="text-[var(--text-primary)]">{compareResult.die2.metrics?.core_current_ratio}</span></div>
                        </div>
                      </div>

                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareResult.overlay_vector_chart}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                            <XAxis dataKey="vector" stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} />
                            <YAxis stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 11 }} unit=" µA" />
                            <Tooltip contentStyle={chart.tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Line
                              type="monotone"
                              dataKey="die1_current_ua"
                              name={`${compareResult.die1.die_uid}`}
                              stroke="#00D2FF"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="die2_current_ua"
                              name={`${compareResult.die2.die_uid}`}
                              stroke="#F59E0B"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)] text-center py-4">
                      Enter another Die UID above and click &quot;Compare&quot; to overlay current curves.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Local 3x3 Wafer Spatial Neighborhood */}
              <Card>
                <CardHeader className="pb-3 border-b border-[var(--border-subtle)]">
                  <CardTitle className="text-base font-bold flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-silicon-cyan" />
                    <span>3×3 Local Wafer Spatial Neighborhood</span>
                  </CardTitle>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Evaluating spatial clustering of abnormal leakage to distinguish localized physical bridges from global wafer-level process shifts.
                  </p>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-xs">
                    {dieData.neighborhood_grid?.map((n: any, idx: number) => {
                      const isCenter = n.is_center;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDieUid(n.die_uid)}
                          className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${
                            isCenter
                              ? "bg-silicon-blue/20 border-silicon-cyan text-[var(--text-primary)] font-bold ring-1 ring-silicon-cyan"
                              : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-silicon-cyan/50"
                          }`}
                        >
                          <div className="text-[10px] text-[var(--text-muted)]">({n.die_x}, {n.die_y})</div>
                          <div className="font-semibold mt-1 text-[var(--text-primary)]">{n.core_median_ua} µA</div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Ratio: {n.current_ratio}</div>
                          {n.true_defect === 1 && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] bg-silicon-ruby/20 text-silicon-ruby font-bold">
                              DEFECT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DieDiagnosisPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-[var(--text-muted)] text-xs">
          Loading die-level diagnosis workspace...
        </div>
      }
    >
      <DieDiagnosisContent />
    </Suspense>
  );
}
