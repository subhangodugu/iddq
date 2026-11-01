import os
import json
import asyncio
import time
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd
from backend.app.core.config import settings

router = APIRouter(prefix="/stream", tags=["realtime"])

class ProberState:
    def __init__(self):
        self.is_running = False
        self.lot_id = "LOT01"
        self.wafer_id = 1
        self.speed_ms = 150  # milliseconds per die
        self.current_index = 0
        self.active_subscribers: List[WebSocket] = []
        self._task: Optional[asyncio.Task] = None
        
        # Cached data
        self.dies_cache: List[Dict[str, Any]] = []
        self.transients_cache: Dict[str, List[Dict[str, Any]]] = {}
        self.probed_dies_map: Dict[str, Dict[str, Any]] = {}
        
        # Live KPIs
        self.total_tested = 0
        self.pass_count = 0
        self.defect_count = 0
        self.time_saved_ms = 0.0
        self.load_wafer_data(self.lot_id, self.wafer_id)

    def load_wafer_data(self, lot_id: str, wafer_id: int):
        self.lot_id = lot_id
        self.wafer_id = wafer_id
        self.current_index = 0
        self.probed_dies_map.clear()
        self.total_tested = 0
        self.pass_count = 0
        self.defect_count = 0
        self.time_saved_ms = 0.0

        die_file = settings.UPLOADS_DIR / "iddq_die_data.csv"
        if not die_file.exists():
            die_file = settings.SAMPLE_DIR / "iddq_die_data.csv"
            
        if die_file.exists():
            df = pd.read_csv(die_file)
            wafer_df = df[(df["lot_id"] == lot_id) & (df["wafer_id"] == wafer_id)]
            if wafer_df.empty:
                wafer_df = df.head(540)
            
            # Sort in raster / snake order: primary sort by Y, secondary sort by X (alternating direction)
            sorted_rows = []
            for y_val, group in wafer_df.groupby("die_y", sort=True):
                if int(y_val) % 2 == 0:
                    sorted_rows.extend(group.sort_values("die_x", ascending=True).to_dict(orient="records"))
                else:
                    sorted_rows.extend(group.sort_values("die_x", ascending=False).to_dict(orient="records"))
            self.dies_cache = sorted_rows
        else:
            # Fallback synthetic dies grid
            self.dies_cache = [
                {
                    "die_uid": f"{lot_id}W{wafer_id:02d}X{x:02d}Y{y:02d}",
                    "lot_id": lot_id,
                    "wafer_id": wafer_id,
                    "die_x": x,
                    "die_y": y,
                    "iddq_mean_ua": 120.0 + (x * y) % 30,
                    "iddq_max_ua": 180.0,
                    "delta_iddq_ua": 15.0,
                    "is_defect": 1 if (x == 12 and y == 12) else 0,
                    "defect_type": "GATE_OXIDE_SHORT" if (x == 12 and y == 12) else "NONE",
                }
                for x in range(1, 25) for y in range(1, 25)
            ]

        # Load transient waveforms from iddq_transients.csv
        trans_file = settings.UPLOADS_DIR / "iddq_transients.csv"
        if not trans_file.exists():
            trans_file = settings.SAMPLE_DIR / "iddq_transients.csv"
        if trans_file.exists():
            try:
                tdf = pd.read_csv(trans_file, nrows=2000)
                time_cols = [c for c in tdf.columns if c.startswith("i_t") and c.endswith("ms_ua")]
                for _, row in tdf.iterrows():
                    d_uid = str(row.get("die_uid", ""))
                    if d_uid and d_uid not in self.transients_cache:
                        pts = []
                        for tc in time_cols:
                            t_str = tc.replace("i_t", "").replace("ms_ua", "")
                            try:
                                t_val = float(t_str)
                            except Exception:
                                t_val = 0.0
                            pts.append({"time_us": round(t_val * 1000, 1), "current_ua": round(float(row[tc]), 2)})
                        self.transients_cache[d_uid] = pts
            except Exception as e:
                print(f"[ProberEngine] Transient parsing notice: {e}")

    def generate_transient_curve(self, die_uid: str, is_defect: bool, mean_ua: float) -> List[Dict[str, float]]:
        if die_uid in self.transients_cache:
            return self.transients_cache[die_uid]
        # Generate representative exponential settling transient
        curve = []
        base = mean_ua
        peak = base * (3.5 if is_defect else 2.2)
        decay = 0.35 if not is_defect else 0.15
        for step in range(25):
            t_us = round(step * 0.4, 2)
            curr = base + (peak - base) * (2.71828 ** (-decay * t_us))
            curve.append({"time_us": t_us, "current_ua": round(curr, 2)})
        return curve

    def advance_one_die(self) -> Optional[Dict[str, Any]]:
        if not self.dies_cache:
            return None
        if self.current_index >= len(self.dies_cache):
            self.current_index = 0  # loop or complete
            
        raw = self.dies_cache[self.current_index]
        self.current_index += 1
        
        die_uid = str(raw.get("die_uid", f"DIE_{self.current_index}"))
        is_defect = bool(raw.get("is_defect", 0) == 1)
        defect_type = str(raw.get("defect_type", "NONE"))
        mean_ua = float(raw.get("iddq_mean_ua", 150.0))
        max_ua = float(raw.get("iddq_max_ua", 220.0))
        delta_ua = float(raw.get("delta_iddq_ua", 25.0))
        
        # Anomaly scoring
        anomaly_score = 0.85 if is_defect else round(min(0.45, max_ua / 450.0), 3)
        status = "DEFECT" if is_defect else ("OUTLIER" if delta_ua > 50.0 else "PASS")
        
        # Test time saving: Settling prediction reduces 20us measurement to 5us (15us = 0.015ms saved per die)
        self.time_saved_ms += 0.015
        self.total_tested += 1
        if is_defect:
            self.defect_count += 1
        else:
            self.pass_count += 1

        waveform = self.generate_transient_curve(die_uid, is_defect, mean_ua)

        die_payload = {
            "die_uid": die_uid,
            "die_x": int(raw.get("die_x", 0)),
            "die_y": int(raw.get("die_y", 0)),
            "lot_id": str(raw.get("lot_id", self.lot_id)),
            "wafer_id": int(raw.get("wafer_id", self.wafer_id)),
            "index": self.current_index,
            "total_dies": len(self.dies_cache),
            "iddq_mean_ua": round(mean_ua, 2),
            "iddq_max_ua": round(max_ua, 2),
            "delta_iddq_ua": round(delta_ua, 2),
            "anomaly_score": anomaly_score,
            "status": status,
            "is_defect": is_defect,
            "defect_type": defect_type if is_defect else None,
            "waveform": waveform,
            "timestamp": time.time(),
        }
        
        self.probed_dies_map[die_uid] = {
            "die_uid": die_uid,
            "x": die_payload["die_x"],
            "y": die_payload["die_y"],
            "status": status,
            "is_defect": is_defect,
            "defect_type": die_payload["defect_type"],
            "iddq_max_ua": die_payload["iddq_max_ua"]
        }
        
        return die_payload

    def get_summary_kpis(self) -> Dict[str, Any]:
        total = max(1, self.total_tested)
        yield_pct = round((self.pass_count / total) * 100, 2)
        defect_rate_pct = round((self.defect_count / total) * 100, 2)
        throughput = round(1000.0 / max(10, self.speed_ms), 1) if self.is_running else 0.0
        
        return {
            "is_running": self.is_running,
            "lot_id": self.lot_id,
            "wafer_id": self.wafer_id,
            "speed_ms": self.speed_ms,
            "current_index": self.current_index,
            "total_wafer_dies": len(self.dies_cache),
            "total_tested": self.total_tested,
            "pass_count": self.pass_count,
            "defect_count": self.defect_count,
            "yield_pct": yield_pct,
            "defect_rate_pct": defect_rate_pct,
            "time_saved_ms": round(self.time_saved_ms, 2),
            "throughput_dies_per_sec": throughput,
        }

prober_engine = ProberState()

async def prober_loop():
    while True:
        if prober_engine.is_running and prober_engine.active_subscribers:
            die_event = prober_engine.advance_one_die()
            if die_event:
                msg = json.dumps({
                    "event": "DIE_PROBED",
                    "die": die_event,
                    "kpis": prober_engine.get_summary_kpis(),
                })
                # Broadcast to all connected clients
                disconnected = []
                for ws in prober_engine.active_subscribers:
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        disconnected.append(ws)
                for ws in disconnected:
                    if ws in prober_engine.active_subscribers:
                        prober_engine.active_subscribers.remove(ws)
                        
        sleep_dur = max(0.01, prober_engine.speed_ms / 1000.0)
        await asyncio.sleep(sleep_dur)

class ProberControlRequest(BaseModel):
    action: str  # "start", "pause", "resume", "step", "set_speed", "load_wafer", "reset"
    lot_id: Optional[str] = None
    wafer_id: Optional[int] = None
    speed_ms: Optional[int] = None

@router.get("/status")
def get_prober_status():
    """Returns current real-time prober engine state and live KPIs."""
    return {
        "status": "online",
        "subscribers_count": len(prober_engine.active_subscribers),
        **prober_engine.get_summary_kpis()
    }

@router.get("/live-snapshot")
def get_live_snapshot():
    """Returns all probed dies on the active wafer and current probe head position."""
    return {
        "kpis": prober_engine.get_summary_kpis(),
        "probed_dies": list(prober_engine.probed_dies_map.values()),
        "total_probed_count": len(prober_engine.probed_dies_map),
        "total_dies": len(prober_engine.dies_cache),
        "current_index": prober_engine.current_index
    }

@router.post("/control")
def control_prober(req: ProberControlRequest):
    """Control real-time prober execution (start, pause, speed, wafer selection)."""
    if req.action == "start":
        if req.lot_id and req.wafer_id:
            prober_engine.load_wafer_data(req.lot_id, req.wafer_id)
        if req.speed_ms:
            prober_engine.speed_ms = max(10, req.speed_ms)
        prober_engine.is_running = True
        
    elif req.action == "pause":
        prober_engine.is_running = False
        
    elif req.action == "resume":
        prober_engine.is_running = True
        
    elif req.action == "step":
        prober_engine.is_running = False
        die = prober_engine.advance_one_die()
        return {"action": "step", "die": die, "kpis": prober_engine.get_summary_kpis()}
        
    elif req.action == "set_speed":
        if req.speed_ms:
            prober_engine.speed_ms = max(10, req.speed_ms)
            
    elif req.action == "load_wafer":
        if req.lot_id and req.wafer_id:
            prober_engine.load_wafer_data(req.lot_id, req.wafer_id)
            
    elif req.action == "reset":
        prober_engine.load_wafer_data(prober_engine.lot_id, prober_engine.wafer_id)
        prober_engine.is_running = False
        
    return {"success": True, "kpis": prober_engine.get_summary_kpis()}

@router.websocket("/ws/prober")
async def websocket_prober_endpoint(websocket: WebSocket):
    """
    High-frequency WebSocket endpoint for live prober telemetry and bilateral control.
    """
    await websocket.accept()
    prober_engine.active_subscribers.append(websocket)
    
    # Send immediate initial handshake and wafer snapshot
    await websocket.send_text(json.dumps({
        "event": "CONNECTED",
        "message": "Real-time ATE prober telemetry stream active",
        "kpis": prober_engine.get_summary_kpis(),
        "probed_dies": list(prober_engine.probed_dies_map.values()),
    }))
    
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                cmd = json.loads(data_text)
                action = cmd.get("action")
                if action == "start":
                    prober_engine.is_running = True
                    if cmd.get("speed_ms"):
                        prober_engine.speed_ms = max(10, int(cmd["speed_ms"]))
                elif action == "pause":
                    prober_engine.is_running = False
                elif action == "resume":
                    prober_engine.is_running = True
                elif action == "set_speed":
                    if cmd.get("speed_ms"):
                        prober_engine.speed_ms = max(10, int(cmd["speed_ms"]))
                elif action == "step":
                    prober_engine.is_running = False
                    die = prober_engine.advance_one_die()
                    if die:
                        await websocket.send_text(json.dumps({
                            "event": "DIE_PROBED",
                            "die": die,
                            "kpis": prober_engine.get_summary_kpis()
                        }))
                elif action == "load_wafer":
                    lot = cmd.get("lot_id", "LOT01")
                    w_id = int(cmd.get("wafer_id", 1))
                    prober_engine.load_wafer_data(lot, w_id)
                    await websocket.send_text(json.dumps({
                        "event": "WAFER_RESET",
                        "kpis": prober_engine.get_summary_kpis(),
                        "probed_dies": []
                    }))
                elif action == "reset":
                    prober_engine.load_wafer_data(prober_engine.lot_id, prober_engine.wafer_id)
                    await websocket.send_text(json.dumps({
                        "event": "WAFER_RESET",
                        "kpis": prober_engine.get_summary_kpis(),
                        "probed_dies": []
                    }))
            except Exception as parse_err:
                await websocket.send_text(json.dumps({"event": "ERROR", "detail": str(parse_err)}))
    except WebSocketDisconnect:
        if websocket in prober_engine.active_subscribers:
            prober_engine.active_subscribers.remove(websocket)
    except Exception:
        if websocket in prober_engine.active_subscribers:
            prober_engine.active_subscribers.remove(websocket)
