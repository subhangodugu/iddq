from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

def get_wafer_map_data(
    df: pd.DataFrame,
    lot_id: str = "LOT01",
    wafer_id: int = 1
) -> Dict[str, Any]:
    """
    Returns wafer map die points and summary stats for a chosen lot and wafer.
    Die grid is 28x28 clipped to circle.
    """
    mask = (df["lot_id"] == lot_id) & (df["wafer_id"] == wafer_id)
    df_w = df[mask].copy()
    
    if len(df_w) == 0:
        return {
            "lot_id": lot_id,
            "wafer_id": wafer_id,
            "die_count": 0,
            "dies": [],
            "stats": {}
        }
        
    dies = []
    for _, r in df_w.iterrows():
        d_info = {
            "die_uid": r["die_uid"],
            "die_x": int(r["die_x"]),
            "die_y": int(r["die_y"]),
            "radius_norm": round(float(r.get("radius_norm", 0)), 3),
            "edge_die": int(r.get("edge_die", 0)),
            "reticle_pos": int(r.get("reticle_pos", 0)),
            "tester_id": str(r.get("tester_id", "T1")),
            "site_id": int(r.get("site_id", 1)),
            "test_temp_c": round(float(r.get("test_temp_c", 25.0)), 1),
            "core_median_ua": round(float(r.get("core_median_ua", r.get("iddq_core_v01_ua", 0))), 1),
            "core_max_ua": round(float(r.get("core_max_ua", 0)), 1),
            "core_current_ratio": round(float(r.get("core_current_ratio", 1.0)), 2),
            "leakage_norm_residual": round(float(r.get("leakage_norm_residual", 0.0)), 2),
            "nnr_ua": round(float(r.get("nearest_neighbor_residual_ua", 0.0)), 1),
            "fixed_limit_fail": int(r.get("fixed_limit_fail", 0)),
            "true_defect": int(r.get("true_defect", 0)),
            "defect_type": str(r.get("defect_type", "none")),
        }
        dies.append(d_info)
        
    # Wafer Level Statistics
    core_medians = [d["core_median_ua"] for d in dies]
    stats = {
        "die_count": len(dies),
        "edge_die_count": sum(d["edge_die"] for d in dies),
        "defective_die_count": sum(d["true_defect"] for d in dies),
        "mean_core_median_ua": round(float(np.mean(core_medians)), 1),
        "p95_core_median_ua": round(float(np.percentile(core_medians, 95)), 1),
        "p05_core_median_ua": round(float(np.percentile(core_medians, 5)), 1),
    }
    
    # 4-Site Bias Analysis on this Wafer
    site_stats = {}
    for s in range(1, 5):
        s_dies = [d for d in dies if d["site_id"] == s]
        if s_dies:
            s_vals = [d["core_median_ua"] for d in s_dies]
            site_stats[f"site_{s}"] = {
                "count": len(s_dies),
                "mean_ua": round(float(np.mean(s_vals)), 1),
                "median_ua": round(float(np.median(s_vals)), 1)
            }
            
    return {
        "lot_id": lot_id,
        "wafer_id": wafer_id,
        "die_count": len(dies),
        "stats": stats,
        "site_stats": site_stats,
        "dies": dies
    }
