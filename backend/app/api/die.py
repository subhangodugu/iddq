import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from backend.app.database.session import get_db
from backend.app.database.models import Dataset
from backend.app.api.analyses import _FEATURE_CACHE, get_or_build_features

router = APIRouter(prefix="/die", tags=["die"])

_TRANS_CACHE: Optional[pd.DataFrame] = None

def get_transients_df(db: Session, project_id: int = 1) -> Optional[pd.DataFrame]:
    global _TRANS_CACHE
    if _TRANS_CACHE is not None:
        return _TRANS_CACHE
    ds = db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.file_type == "transients", Dataset.status == "valid").first()
    if not ds or not os.path.exists(ds.file_path):
        return None
    _TRANS_CACHE = pd.read_csv(ds.file_path)
    return _TRANS_CACHE

def get_active_features_df(db: Session, project_id: int = 1) -> pd.DataFrame:
    ds = db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.file_type == "die_data", Dataset.status == "valid").first()
    if not ds:
        raise HTTPException(status_code=404, detail="Die dataset not loaded")
    df_die = pd.read_csv(ds.file_path)
    return get_or_build_features(df_die, ds.checksum_sha256)

@router.get("/search")
def search_die(
    query: Optional[str] = Query(None, description="Die UID prefix or Lot name"),
    lot_id: Optional[str] = Query(None),
    wafer_id: Optional[int] = Query(None),
    die_x: Optional[int] = Query(None),
    die_y: Optional[int] = Query(None),
    limit: int = 20,
    db: Session = Depends(get_db)
):
    df = get_active_features_df(db)
    
    sub = df
    if query:
        q = query.strip().upper()
        sub = sub[sub["die_uid"].str.contains(q, na=False)]
    if lot_id:
        sub = sub[sub["lot_id"] == lot_id]
    if wafer_id is not None:
        sub = sub[sub["wafer_id"] == wafer_id]
    if die_x is not None and die_y is not None:
        sub = sub[(sub["die_x"] == die_x) & (sub["die_y"] == die_y)]
        
    cols = ["die_uid", "lot_id", "wafer_id", "die_x", "die_y", "core_median_ua", "core_max_ua", "core_current_ratio", "leakage_norm_residual", "fixed_limit_fail", "true_defect", "defect_type"]
    avail = [c for c in cols if c in sub.columns]
    
    return sub[avail].head(limit).to_dict(orient="records")

def _fetch_die_diagnosis(die_uid: str, db: Session):
    df = get_active_features_df(db)
    
    match = df[df["die_uid"] == die_uid]
    if len(match) == 0:
        raise HTTPException(status_code=404, detail=f"Die UID '{die_uid}' not found")
        
    r = match.iloc[0]
    
    # 1. Vector Profile (20 Core Vectors)
    core_curve = []
    for i in range(1, 21):
        col = f"iddq_core_v{i:02d}_ua"
        val = float(r[col]) if col in r else 0.0
        core_curve.append({
            "vector_id": f"v{i:02d}",
            "vector_num": i,
            "current_ua": round(val, 2)
        })
        
    # 2. Wafer Reference Median Curve (Nominal comparison)
    lot_id = r["lot_id"]
    wafer_id = r["wafer_id"]
    wafer_die = df[(df["lot_id"] == lot_id) & (df["wafer_id"] == wafer_id)]
    
    wafer_ref_curve = []
    for i in range(1, 21):
        col = f"iddq_core_v{i:02d}_ua"
        w_med = float(wafer_die[col].median()) if col in wafer_die else 0.0
        wafer_ref_curve.append({
            "vector_id": f"v{i:02d}",
            "vector_num": i,
            "wafer_median_ua": round(w_med, 2)
        })
        
    # Combine profile for charting
    chart_series = []
    for i in range(20):
        chart_series.append({
            "vector": core_curve[i]["vector_id"],
            "die_current_ua": core_curve[i]["current_ua"],
            "wafer_median_ua": wafer_ref_curve[i]["wafer_median_ua"],
            "excess_current_ua": round(max(0.0, core_curve[i]["current_ua"] - wafer_ref_curve[i]["wafer_median_ua"]), 2)
        })
        
    # 3. Local Wafer Neighborhood (8 surrounding dice)
    cx, cy = int(r["die_x"]), int(r["die_y"])
    neighbors = []
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            nx, ny = cx + dx, cy + dy
            n_match = wafer_die[(wafer_die["die_x"] == nx) & (wafer_die["die_y"] == ny)]
            if len(n_match) > 0:
                nr = n_match.iloc[0]
                neighbors.append({
                    "rel_x": dx, "rel_y": dy,
                    "die_uid": nr["die_uid"],
                    "die_x": nx, "die_y": ny,
                    "is_center": (dx == 0 and dy == 0),
                    "core_median_ua": round(float(nr.get("core_median_ua", 0)), 1),
                    "current_ratio": round(float(nr.get("core_current_ratio", 1.0)), 2),
                    "fixed_limit_fail": int(nr.get("fixed_limit_fail", 0)),
                    "true_defect": int(nr.get("true_defect", 0))
                })
                
    # 4. Suspected Defect Hypothesis Reasoning
    ratio = float(r.get("core_current_ratio", 1.0))
    norm_res = float(r.get("leakage_norm_residual", 0.0))
    delta = float(r.get("max_delta_iddq_ua", 0.0))
    core_max = float(r.get("core_max_ua", 0.0))
    
    hypothesis = "Normal Silicon"
    confidence = "Low"
    investigation = "Standard test flow recommended."
    
    if ratio > 1.35 and delta > 25.0:
        hypothesis = "Bridge Defect (State-Dependent Short)"
        confidence = "High"
        investigation = "Inspect vector step transitions. Cross-reference layout netlist for nets active during elevated vectors."
    elif norm_res > 3.5 and ratio < 1.15:
        hypothesis = "Gate-Oxide Breakdown / Uniform Leakage Short"
        confidence = "High"
        investigation = "Perform temperature/voltage sensitivity test. Elevation is state-independent across all vectors."
    elif delta > 15.0 and ratio > 1.2:
        hypothesis = "Open / Floating Gate Defect"
        confidence = "Moderate"
        investigation = "Trace floating node charging behavior. Confirm settling response with transient characterization."
    elif norm_res > 2.0 or ratio > 1.15:
        hypothesis = "Latent / Marginal Anomaly"
        confidence = "Moderate"
        investigation = "Flag for extended burn-in stress. Monitor downstream reliability tracking."

    # Determine Status Category
    is_gt = bool(r.get("true_defect", 0) == 1) if "true_defect" in r else False
    if is_gt:
        status_category = "CONFIRMED_DEFECT"
    elif norm_res >= 3.5 or ratio >= 1.35:
        status_category = "MODEL_PREDICTED"
    elif abs(norm_res) >= 3.0 or core_max > 450.0:
        status_category = "STATISTICAL_ANOMALY"
    elif ratio > 1.2 or delta > 15.0:
        status_category = "UNVERIFIED_SUSPECT"
    else:
        status_category = "NORMAL_SILICON"

    # 5. Extract Real Transient Waveforms if available in iddq_transients.csv
    trans_waveforms = []
    df_trans = get_transients_df(db)
    if df_trans is not None:
        die_trans = df_trans[df_trans["die_uid"] == die_uid]
        if len(die_trans) > 0:
            time_cols = [f"i_t{t:.1f}ms_ua" for t in np.round(np.arange(0.1, 2.01, 0.1), 1)]
            avail_times = [c for c in time_cols if c in df_trans.columns]
            
            for _, tr in die_trans.iterrows():
                vec_id = tr.get("vector_id", 1)
                rail = str(tr.get("rail", "core"))
                settled_ua = float(tr.get("settled_iddq_ua", 0.0))
                settle_time_ms = float(tr.get("full_settle_time_ms", 3.0))
                
                # Compute reference median for clean die for this vector
                clean_vec_trans = df_trans[(df_trans["vector_id"] == vec_id) & (df_trans.get("true_defect", 0) == 0)]
                
                series = []
                for c in avail_times:
                    t_val = float(c.replace("i_t", "").replace("ms_ua", ""))
                    d_cur = float(tr[c])
                    ref_cur = float(clean_vec_trans[c].median()) if len(clean_vec_trans) > 0 else d_cur
                    series.append({
                        "time_ms": t_val,
                        "die_current_ua": round(d_cur, 2),
                        "ref_current_ua": round(ref_cur, 2),
                        "settled_target_ua": round(settled_ua, 2)
                    })
                    
                trans_waveforms.append({
                    "vector_id": f"v{int(vec_id):02d}",
                    "rail": rail,
                    "settled_iddq_ua": round(settled_ua, 2),
                    "full_settle_time_ms": round(settle_time_ms, 2),
                    "time_series": series
                })
        
    return {
        "die_uid": r["die_uid"],
        "lot_id": r["lot_id"],
        "wafer_id": int(r["wafer_id"]),
        "die_x": cx,
        "die_y": cy,
        "radius_norm": round(float(r.get("radius_norm", 0)), 3),
        "edge_die": int(r.get("edge_die", 0)),
        "reticle_pos": int(r.get("reticle_pos", 0)),
        "tester_id": str(r.get("tester_id", "T1")),
        "site_id": int(r.get("site_id", 1)),
        "test_temp_c": round(float(r.get("test_temp_c", 25.0)), 1),
        "status_category": status_category,
        "metrics": {
            "core_min_ua": round(float(r.get("core_min_ua", 0)), 1),
            "core_max_ua": round(core_max, 1),
            "core_mean_ua": round(float(r.get("core_mean_ua", 0)), 1),
            "core_median_ua": round(float(r.get("core_median_ua", 0)), 1),
            "core_current_ratio": round(ratio, 2),
            "max_delta_iddq_ua": round(delta, 1),
            "leakage_norm_residual": round(norm_res, 2),
            "nearest_neighbor_residual_ua": round(float(r.get("nearest_neighbor_residual_ua", 0)), 1),
            "ring_osc_mhz": round(float(r.get("ring_osc_mhz", 0)), 1),
            "leak_monitor_ua": round(float(r.get("leak_monitor_ua", 0)), 3)
        },
        "flags": {
            "fixed_limit_fail": int(r.get("fixed_limit_fail", 0)),
            "ratio_screen_fail": int(ratio > 1.25),
            "norm_res_fail": int(abs(norm_res) > 3.0),
        },
        "diagnosis": {
            "suspected_defect_type": hypothesis,
            "confidence": confidence,
            "recommended_next_step": investigation,
            "evidence": f"Ratio={ratio:.2f}, Max Delta={delta:.1f} µA, Process Residual={norm_res:+.2f} σ"
        },
        "ground_truth_evaluation_only": {
            "true_defect": int(r.get("true_defect", 0)),
            "actual_defect_type": str(r.get("defect_type", "none")),
            "defect_fault_id": int(r.get("defect_fault_id", -1)),
            "defect_current_ua": round(float(r.get("defect_current_ua", 0)), 2)
        },
        "vector_profile_chart": chart_series,
        "has_transient_characterization": len(trans_waveforms) > 0,
        "transient_waveforms": trans_waveforms,
        "neighborhood_grid": neighbors
    }

@router.get("/compare")
def compare_dies(
    die1_uid: str = Query(..., description="First die UID"),
    die2_uid: str = Query(..., description="Second die UID"),
    db: Session = Depends(get_db)
):
    """
    Compares two dies side-by-side, overlaying their 20-vector current signatures
    and transient settling profiles if available.
    """
    d1 = _fetch_die_diagnosis(die1_uid, db)
    d2 = _fetch_die_diagnosis(die2_uid, db)
    
    # Merge vector profiles for overlay charting
    v1_map = {item["vector"]: item["die_current_ua"] for item in d1["vector_profile_chart"]}
    v2_map = {item["vector"]: item["die_current_ua"] for item in d2["vector_profile_chart"]}
    
    combined_vectors = []
    for i in range(1, 21):
        vec_id = f"v{i:02d}"
        c1 = v1_map.get(vec_id, 0.0)
        c2 = v2_map.get(vec_id, 0.0)
        combined_vectors.append({
            "vector": vec_id,
            "die1_current_ua": c1,
            "die2_current_ua": c2,
            "delta_ua": round(abs(c1 - c2), 2)
        })
        
    return {
        "die1": {
            "die_uid": d1["die_uid"],
            "lot_id": d1["lot_id"],
            "wafer_id": d1["wafer_id"],
            "status_category": d1["status_category"],
            "metrics": d1["metrics"],
            "diagnosis": d1["diagnosis"]
        },
        "die2": {
            "die_uid": d2["die_uid"],
            "lot_id": d2["lot_id"],
            "wafer_id": d2["wafer_id"],
            "status_category": d2["status_category"],
            "metrics": d2["metrics"],
            "diagnosis": d2["diagnosis"]
        },
        "overlay_vector_chart": combined_vectors
    }

@router.get("/{die_uid}")
def get_die_diagnosis(die_uid: str, db: Session = Depends(get_db)):
    """Fetches comprehensive IDDQ signature, transient waves, and neighborhood for a specific die."""
    return _fetch_die_diagnosis(die_uid, db)


