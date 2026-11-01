"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Activity,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Volume2,
  VolumeX,
  Layers,
  Cpu,
  Target
} from "lucide-react";
import {
  getStreamWebSocketUrl,
  fetchStreamStatus,
  fetchStreamSnapshot,
  controlStream,
  fetchWaferLots,
  fetchWaferDetails
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export default function RealtimeProberPage() {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();

  // Connection and Engine State
  const [connected, setConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(150);
  const [selectedLot, setSelectedLot] = useState("LOT01");
  const [selectedWafer, setSelectedWafer] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Prober Data State
  const [activeDie, setActiveDie] = useState<any>(null);
  const [, setProbedDies] = useState<Map<string, any>>(new Map());
  const [defectLogs, setDefectLogs] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({
    total_wafer_dies: 540,
    total_tested: 0,
    pass_count: 0,
    defect_count: 0,
    yield_pct: 0,
    defect_rate_pct: 0,
    time_saved_ms: 0,
    throughput_dies_per_sec: 0,
  });

  const [lots, setLots] = useState<any[]>([]);
  const [waferDies, setWaferDies] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playDefectSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    fetchWaferLots()
      .then((data) => {
        if (data?.lots) setLots(data.lots);
      })
      .catch(() => {});

    fetchStreamSnapshot()
      .then((snap) => {
        if (snap.kpis) setKpis(snap.kpis);
        if (snap.probed_dies) {
          const map = new Map<string, any>();
          snap.probed_dies.forEach((d: any) => map.set(d.die_uid, d));
          setProbedDies(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWaferDetails(selectedLot, selectedWafer)
      .then((data) => {
        if (!cancelled) setWaferDies(Array.isArray(data?.dies) ? data.dies : []);
      })
      .catch(() => {
        if (!cancelled) setWaferDies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLot, selectedWafer]);

  useEffect(() => {
    const wsUrl = getStreamWebSocketUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "DIE_PROBED") {
          const die = msg.die;
          setActiveDie(die);
          if (msg.kpis) {
            setKpis(msg.kpis);
            setIsRunning(msg.kpis.is_running);
          }
          setProbedDies((prev) => {
            const next = new Map(prev);
            next.set(die.die_uid, {
              die_uid: die.die_uid,
              x: die.die_x,
              y: die.die_y,
              status: die.status,
              is_defect: die.is_defect,
              defect_type: die.defect_type,
              iddq_max_ua: die.iddq_max_ua,
            });
            return next;
          });

          if (die.is_defect) {
            playDefectSound();
            setDefectLogs((prev) => [
              {
                id: Date.now() + Math.random(),
                die_uid: die.die_uid,
                x: die.die_x,
                y: die.die_y,
                defect_type: die.defect_type || "GATE_OXIDE_SHORT",
                current: die.iddq_max_ua,
                anomaly_score: die.anomaly_score,
                time: new Date().toLocaleTimeString(),
              },
              ...prev.slice(0, 49),
            ]);
          }
        } else if (msg.event === "CONNECTED") {
          setConnected(true);
          if (msg.kpis) {
            setKpis(msg.kpis);
            setIsRunning(msg.kpis.is_running);
          }
        } else if (msg.event === "WAFER_RESET") {
          setProbedDies(new Map());
          setActiveDie(null);
          setDefectLogs([]);
          if (msg.kpis) {
            setKpis(msg.kpis);
            setIsRunning(false);
          }
        }
      } catch (err) {
        console.error("WS Parse Error:", err);
      }
    };

    ws.onerror = () => {
      toast("Live prober connection failed. Check that the API is running.", "error");
    };

    ws.onclose = () => {
      setConnected(false);
      setIsRunning(false);
    };

    return () => ws.close();
  }, [playDefectSound, toast]);

  const handleStart = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "start", speed_ms: speedMs }));
    } else {
      controlStream("start", { speed_ms: speedMs }).then(() => setIsRunning(true));
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "pause" }));
    } else {
      controlStream("pause").then(() => setIsRunning(false));
    }
    setIsRunning(false);
  };

  const handleStep = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "step" }));
    } else {
      controlStream("step").then((res) => {
        if (res.die) setActiveDie(res.die);
      });
    }
  };

  const handleReset = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "reset" }));
    } else {
      controlStream("reset").then(() => {
        setProbedDies(new Map());
        setActiveDie(null);
        setDefectLogs([]);
      });
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeedMs(newSpeed);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "set_speed", speed_ms: newSpeed }));
    } else {
      controlStream("set_speed", { speed_ms: newSpeed });
    }
  };

  const handleWaferChange = (lot: string, wafer: number) => {
    setSelectedLot(lot);
    setSelectedWafer(wafer);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "load_wafer", lot_id: lot, wafer_id: wafer }));
    } else {
      controlStream("load_wafer", { lot_id: lot, wafer_id: wafer }).then(() => {
        setProbedDies(new Map());
        setActiveDie(null);
      });
    }
  };

  // Canvas Wafer Map Render (Theme Adaptive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = resolvedTheme === "dark";
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const waferRadius = Math.min(centerX, centerY) - 20;

    // Wafer Disc Background
    ctx.beginPath();
    ctx.arc(centerX, centerY, waferRadius, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#0A111A" : "#F1F5F9";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isDark ? "#1E293B" : "#CBD5E1";
    ctx.stroke();

    // Bottom Notch
    ctx.beginPath();
    ctx.arc(centerX, centerY + waferRadius, 8, Math.PI, 0, false);
    ctx.fillStyle = isDark ? "#1E293B" : "#CBD5E1";
    ctx.fill();

    // Alignment Ring Guides
    [0.75, 0.5, 0.25].forEach((scale) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, waferRadius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    const dies = waferDies.length > 0 ? waferDies : [];
    const xs = dies.map((d) => Number(d.die_x));
    const ys = dies.map((d) => Number(d.die_y));
    const minX = xs.length ? Math.min(...xs) : 1;
    const maxX = xs.length ? Math.max(...xs) : 28;
    const minY = ys.length ? Math.min(...ys) : 1;
    const maxY = ys.length ? Math.max(...ys) : 28;
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const dieStep = (waferRadius * 1.82) / (span + 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const colorFor = (die: any) => {
      if (die.true_defect === 1 || die.fixed_limit_fail === 1) return "#EF4444";
      const val = Number(die.core_median_ua ?? die.iddq_max_ua ?? 150);
      if (val > 350) return "#EF4444";
      if (val > 250) return "#F59E0B";
      if (val > 180) return "#38BDF8";
      return "#10B981";
    };

    dies.forEach((die) => {
      const x = Number(die.die_x);
      const y = Number(die.die_y);
      const dx = centerX + (x - midX) * dieStep - dieStep / 2;
      const dy = centerY + (y - midY) * dieStep - dieStep / 2;
      const dieCenterX = dx + dieStep / 2;
      const dieCenterY = dy + dieStep / 2;
      if (Math.hypot(dieCenterX - centerX, dieCenterY - centerY) > waferRadius - 4) return;

      ctx.fillStyle = colorFor(die);
      ctx.fillRect(dx + 0.5, dy + 0.5, Math.max(dieStep - 1.5, 1), Math.max(dieStep - 1.5, 1));

      if (activeDie && Number(activeDie.die_x) === x && Number(activeDie.die_y) === y) {
        ctx.strokeStyle = isDark ? "#FFFFFF" : "#0F172A";
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 1, dy - 1, dieStep + 1, dieStep + 1);
      }
    });
  }, [waferDies, activeDie, resolvedTheme]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Real-Time ATE Prober Studio"
        subtitle="High-frequency WebSocket telemetry stream &middot; Dual-speed transient settling analysis &middot; Microampere precision"
        icon={Radio}
        badge={
          <StatusBadge
            status={connected ? (isRunning ? "live" : "pass") : "defect"}
            label={connected ? (isRunning ? "PROBING LIVE" : "ATE READY - PAUSED") : "CONNECTING..."}
          />
        }
        actions={
          <div className="flex items-center space-x-3 text-xs bg-app-card border border-app-border px-4 py-2 rounded-xl shadow-sm">
            <div>
              <div className="text-[10px] text-app-muted uppercase">Throughput</div>
              <div className="text-silicon-cyan font-bold">
                {isRunning ? `${(1000 / speedMs).toFixed(1)} dies/s` : "0.0 dies/s"}
              </div>
            </div>
            <div className="border-r border-app-border h-6" />
            <div>
              <div className="text-[10px] text-app-muted uppercase">Yield</div>
              <div className="text-silicon-emerald font-bold">{kpis.yield_pct}%</div>
            </div>
            <div className="border-r border-app-border h-6" />
            <div>
              <div className="text-[10px] text-app-muted uppercase">Saved</div>
              <div className="text-silicon-amber font-bold">+{kpis.time_saved_ms} ms</div>
            </div>
          </div>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 300mm Waber Prober Canvas (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="flex flex-col justify-between h-full">
            <CardHeader className="flex-wrap items-end gap-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-app-text">
                <Layers className="w-4 h-4 text-silicon-cyan" />
                <span>300mm Silicon Wafer Prober &middot; {selectedLot} #{selectedWafer}</span>
              </div>

              {/* Wafer & Lot Selectors */}
              <div className="flex items-end gap-2">
                <Select
                  label="Lot"
                  value={selectedLot}
                  onChange={(e) => handleWaferChange(e.target.value, selectedWafer)}
                  className="min-w-[8rem]"
                >
                  {(lots.length > 0 ? lots : ["LOT01", "LOT02", "LOT03"]).map((lot: any) => {
                    const lotId = typeof lot === "string" ? lot : lot.lot_id;
                    return (
                      <option key={lotId} value={lotId}>
                        {lotId}
                      </option>
                    );
                  })}
                </Select>

                <Select
                  label="Wafer"
                  value={selectedWafer}
                  onChange={(e) => handleWaferChange(selectedLot, parseInt(e.target.value))}
                  className="min-w-[8rem]"
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Wafer {w}
                    </option>
                  ))}
                </Select>
              </div>
            </CardHeader>

            {/* Canvas Container */}
            <div className="flex justify-center items-center py-4 relative">
              <canvas
                ref={canvasRef}
                width={520}
                height={520}
                className="max-w-full h-auto rounded-full shadow-lg"
              />

              {activeDie && (
                <div className="absolute top-4 left-4 bg-app-card/95 border border-app-border p-3 rounded-xl text-xs space-y-1 shadow-xl pointer-events-none backdrop-blur-md">
                  <div className="text-[10px] text-app-muted uppercase font-bold">Active Probe Head</div>
                  <div className="text-silicon-cyan font-bold">{activeDie.die_uid}</div>
                  <div className="text-app-text text-[11px]">
                    X: <span className="font-bold">{activeDie.die_x}</span> | Y:{" "}
                    <span className="font-bold">{activeDie.die_y}</span>
                  </div>
                  <div className="text-app-muted text-[11px]">
                    Current: <strong className="text-silicon-cyan">{activeDie.iddq_max_ua} μA</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-[11px] text-app-muted">
              <span className="type-numeric">{waferDies.length.toLocaleString("en-US")} die</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" /> ≤180 µA</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#38BDF8]" /> ≤250 µA</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#F59E0B]" /> ≤350 µA</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#EF4444]" /> Defect or &gt;350 µA</span>
            </div>

            {/* Prober Transport Controls Bar */}
            <div className="pt-4 border-t border-app-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                {!isRunning ? (
                  <Button variant="primary" size="sm" icon={Play} onClick={handleStart}>
                    START PROBER
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={Pause} onClick={handlePause}>
                    PAUSE
                  </Button>
                )}

                <Button variant="outline" size="sm" icon={SkipForward} disabled={isRunning} onClick={handleStep}>
                  Step
                </Button>

                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset}>
                  Reset
                </Button>

                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    soundEnabled
                      ? "bg-silicon-cyan/20 border-silicon-cyan/50 text-silicon-cyan"
                      : "bg-app-cardHover border-app-border text-app-muted hover:text-app-text"
                  }`}
                  title={soundEnabled ? "Audio Alarms Enabled" : "Audio Alarms Muted"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>

              {/* Speed Presets */}
              <div className="flex items-center space-x-1 bg-app-cardHover p-1 rounded-xl border border-app-border text-xs">
                <span className="text-app-muted text-[10px] px-2 font-bold uppercase">Speed:</span>
                {[
                  { label: "0.5x", val: 300 },
                  { label: "1x", val: 150 },
                  { label: "2x", val: 75 },
                  { label: "5x Turbo", val: 20 },
                ].map((s) => (
                  <button
                    key={s.val}
                    onClick={() => handleSpeedChange(s.val)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      speedMs === s.val
                        ? "bg-silicon-cyan text-[rgb(var(--on-accent))] font-semibold shadow-sm"
                        : "text-app-muted hover:text-app-text"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Transient Oscilloscope & Live Defect Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live IDDQ Transient Oscilloscope Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  <Activity className="w-4 h-4 text-silicon-cyan" />
                  <span>Transient IDDQ Current Oscilloscope</span>
                </CardTitle>
                <CardDescription>Microampere decay curve with early termination window</CardDescription>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-app-cardHover text-silicon-cyan border border-app-border font-semibold">
                Window: k=5 (5μs)
              </span>
            </CardHeader>

            <CardContent>
              {/* Waveform Canvas / SVG Container */}
              <div className="bg-app-bg border border-app-border rounded-xl p-3 h-48 relative overflow-hidden flex flex-col justify-between">
                {/* Reference Grid */}
                <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="border border-silicon-cyan/20" />
                  ))}
                </div>

                {/* Legacy Limit Reference Line */}
                <div className="absolute top-8 left-0 right-0 border-b border-dashed border-silicon-ruby/60 z-10">
                  <span className="absolute right-2 -top-4 text-[9px] text-silicon-ruby font-bold">
                    Fixed Screen Limit: 450 μA
                  </span>
                </div>

                {/* Waveform SVG */}
                {activeDie?.waveform && activeDie.waveform.length > 0 ? (
                  <svg className="w-full h-full relative z-0" viewBox="0 0 300 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const pts = activeDie.waveform;
                      const maxVal = Math.max(...pts.map((p: any) => p.current_ua), 500);
                      const coords = pts.map((p: any, idx: number) => {
                        const x = (idx / (pts.length - 1)) * 300;
                        const y = 120 - (p.current_ua / maxVal) * 110;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      });
                      const dLine = coords.join(" ");
                      const dArea = `0,120 ${dLine} 300,120`;

                      return (
                        <>
                          <polygon points={dArea} fill="url(#waveGrad)" />
                          <polyline
                            fill="none"
                            stroke={activeDie.is_defect ? "#EF4444" : "#06B6D4"}
                            strokeWidth="2.5"
                            points={dLine}
                          />
                        </>
                      );
                    })()}
                  </svg>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-app-muted">
                    Waiting for prober pulse...
                  </div>
                )}

                {/* Instantaneous Values */}
                <div className="flex items-center justify-between text-[11px] z-10 pt-1 text-app-muted border-t border-app-border/40">
                  <span>
                    Peak: <strong className="text-app-text">{activeDie?.iddq_max_ua || "--"} μA</strong>
                  </span>
                  <span>
                    Settled: <strong className="text-silicon-cyan">{activeDie?.iddq_mean_ua || "--"} μA</strong>
                  </span>
                  <span>
                    ΔIDDQ: <strong className="text-silicon-amber">{activeDie?.delta_iddq_ua || "--"} μA</strong>
                  </span>
                </div>
              </div>

              {/* Status Footer */}
              <div className="mt-3 text-[11px] text-app-muted bg-app-cardHover/50 p-2.5 rounded-xl border border-app-border flex items-center justify-between">
                <span className="text-app-text">
                  Classification:{" "}
                  <strong
                    className={
                      activeDie?.is_defect
                        ? "text-silicon-ruby font-bold"
                        : activeDie?.status === "OUTLIER"
                        ? "text-silicon-amber font-bold"
                        : "text-silicon-emerald font-bold"
                    }
                  >
                    {activeDie?.status || "STANDBY"}
                  </strong>
                </span>
                <span className="text-[10px] text-silicon-cyan">
                  {activeDie?.defect_type ? `Defect: ${activeDie.defect_type}` : "Clean Steady State"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Real-Time Defect Log Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  <AlertTriangle className="w-4 h-4 text-silicon-ruby" />
                  <span>Live Defect Telemetry Stream</span>
                </CardTitle>
                <CardDescription>Instantaneous anomaly and screen violations feed</CardDescription>
              </div>
              <StatusBadge status="defect" label={`${kpis.defect_count} Caught`} />
            </CardHeader>

            <CardContent>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {defectLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-app-cardHover border border-silicon-ruby/30 hover:border-silicon-ruby p-2.5 rounded-xl text-xs flex items-center justify-between transition-all"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-app-text font-bold">{log.die_uid}</span>
                        <span className="text-[9px] bg-silicon-ruby/20 text-silicon-ruby px-1.5 py-0.2 rounded font-semibold">
                          {log.defect_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-app-muted">
                        Coord: ({log.x}, {log.y}) &middot; Current:{" "}
                        <span className="text-silicon-ruby font-bold">{log.current} μA</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-app-muted">
                      <div>Score: {log.anomaly_score}</div>
                      <div>{log.time}</div>
                    </div>
                  </div>
                ))}

                {defectLogs.length === 0 && (
                  <div className="py-8 text-center text-xs text-app-muted">
                    {isRunning
                      ? "No defects caught yet on active wafer track..."
                      : "Prober paused. Click 'START PROBER' to begin real-time stream."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
