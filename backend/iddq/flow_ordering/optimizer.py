from typing import Dict, Any, List
import numpy as np
import pandas as pd

def optimize_vector_flow_order(
    df_faults: pd.DataFrame,
    df_vinfo: pd.DataFrame
) -> Dict[str, Any]:
    """
    Ranks vectors by detection efficiency (fallout rate per unit test time)
    to minimize average simulated test time under stop-on-first-fail policy.
    """
    vcols = [c for c in df_faults.columns if c.startswith("v") and len(c) == 3]
    vcols.sort()
    
    # Timing per vector
    time_map = {}
    for _, r in df_vinfo.iterrows():
        vid = f"v{int(r['vector_id']):02d}"
        t_total = float(r["apply_time_ms"] + r["full_settle_time_ms"] + r["measure_time_ms"])
        time_map[vid] = t_total
        
    M = df_faults[vcols].to_numpy().astype(bool)
    n_faults, n_vecs = M.shape
    
    # Faults detected by each vector
    fault_counts = M.sum(axis=0)
    
    # Efficiency = faults / time
    efficiencies = []
    for i, col in enumerate(vcols):
        t = time_map.get(col, 5.0)
        fc = int(fault_counts[i])
        eff = fc / max(0.1, t)
        efficiencies.append({
            "vector_id": col,
            "vector_num": int(col[1:]),
            "faults_detected": fc,
            "vector_time_ms": round(t, 2),
            "efficiency_faults_per_ms": round(eff, 2)
        })
        
    # Sort in descending order of efficiency
    proposed_order = sorted(efficiencies, key=lambda x: x["efficiency_faults_per_ms"], reverse=True)
    for idx, item in enumerate(proposed_order):
        item["proposed_rank"] = idx + 1
        
    original_order = sorted(efficiencies, key=lambda x: x["vector_num"])
    for idx, item in enumerate(original_order):
        item["original_rank"] = idx + 1
        
    return {
        "vector_count": len(vcols),
        "total_test_time_ms": round(sum(time_map.values()), 2),
        "proposed_flow_order": proposed_order,
        "original_flow_order": original_order,
        "first_fail_optimization_summary": "Vectors with highest defect fallout per millisecond are scheduled earliest in the sequence, allowing defective die to fail fast and abort earlier in stop-on-first-fail ATE flows."
    }
