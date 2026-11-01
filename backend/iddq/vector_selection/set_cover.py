from typing import Dict, Any, List, Set, Tuple, Optional
import numpy as np
import pandas as pd

def run_greedy_set_cover(
    df_faults: pd.DataFrame,
    df_vinfo: pd.DataFrame,
    target_coverage_pct: float = 100.0,
    max_vectors: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes time-weighted greedy set-cover algorithm on vector_fault_matrix.
    Weights incremental coverage by per-vector execution time:
      Score(v) = (New Faults Covered) / (apply_time + settle_time + measure_time)
    """
    vcols = [c for c in df_faults.columns if c.startswith("v") and len(c) == 3]
    vcols.sort()
    
    # Calculate execution time per vector (ms)
    time_map = {}
    for _, r in df_vinfo.iterrows():
        vid = f"v{int(r['vector_id']):02d}"
        t_total = float(r["apply_time_ms"] + r["full_settle_time_ms"] + r["measure_time_ms"])
        time_map[vid] = t_total
        
    total_faults = len(df_faults)
    target_fault_count = int(np.ceil((target_coverage_pct / 100.0) * total_faults))
    
    # Fault indicator matrix: rows=faults, cols=vectors
    M = df_faults[vcols].to_numpy().astype(bool)
    n_faults, n_vecs = M.shape
    
    covered_fault_mask = np.zeros(n_faults, dtype=bool)
    selected_vectors: List[Dict[str, Any]] = []
    available_indices = list(range(n_vecs))
    
    progression: List[Dict[str, Any]] = []
    cumulative_time_ms = 0.0
    
    while len(available_indices) > 0:
        current_covered = int(covered_fault_mask.sum())
        if current_covered >= target_fault_count:
            break
        if max_vectors is not None and len(selected_vectors) >= max_vectors:
            break
            
        best_v_idx = -1
        best_score = -1.0
        best_new_covered = 0
        
        for v_idx in available_indices:
            v_col = vcols[v_idx]
            v_time = time_map.get(v_col, 5.0)
            
            # New faults this vector would add
            new_faults = M[:, v_idx] & (~covered_fault_mask)
            gain = int(new_faults.sum())
            score = gain / max(v_time, 0.01)
            
            if score > best_score:
                best_score = score
                best_v_idx = v_idx
                best_new_covered = gain
                
        if best_v_idx == -1 or best_new_covered == 0:
            # No further gains possible
            break
            
        chosen_col = vcols[best_v_idx]
        available_indices.remove(best_v_idx)
        covered_fault_mask |= M[:, best_v_idx]
        
        v_time = time_map.get(chosen_col, 5.0)
        cumulative_time_ms += v_time
        cov_count = int(covered_fault_mask.sum())
        cov_pct = round(100.0 * cov_count / total_faults, 2)
        
        step_info = {
            "step": len(selected_vectors) + 1,
            "vector_id": chosen_col,
            "vector_num": int(chosen_col[1:]),
            "vector_time_ms": round(v_time, 2),
            "cumulative_time_ms": round(cumulative_time_ms, 2),
            "new_faults_covered": best_new_covered,
            "total_faults_covered": cov_count,
            "fault_coverage_pct": cov_pct,
            "efficiency_faults_per_ms": round(best_score, 2)
        }
        selected_vectors.append(step_info)
        progression.append(step_info)
        
    final_covered = int(covered_fault_mask.sum())
    final_cov_pct = round(100.0 * final_covered / total_faults, 2)
    uncovered_indices = np.where(~covered_fault_mask)[0].tolist()
    
    total_original_time_ms = sum(time_map.values())
    time_saved_ms = max(0.0, total_original_time_ms - cumulative_time_ms)
    time_reduction_pct = round(100.0 * time_saved_ms / total_original_time_ms, 2)
    
    selected_vector_ids = [s["vector_id"] for s in selected_vectors]
    removed_vector_ids = [v for v in vcols if v not in selected_vector_ids]
    
    return {
        "target_coverage_pct": target_coverage_pct,
        "selected_vector_count": len(selected_vectors),
        "total_available_vectors": len(vcols),
        "retained_vectors": selected_vector_ids,
        "removed_vectors": removed_vector_ids,
        "modeled_fault_coverage_pct": final_cov_pct,
        "faults_covered": final_covered,
        "total_faults": total_faults,
        "uncovered_fault_count": len(uncovered_indices),
        "uncovered_fault_ids": uncovered_indices[:50],  # preview up to 50
        "cumulative_time_ms": round(cumulative_time_ms, 2),
        "original_total_time_ms": round(total_original_time_ms, 2),
        "time_saved_ms": round(time_saved_ms, 2),
        "time_reduction_pct": time_reduction_pct,
        "progression": progression
    }

def evaluate_reduced_vectors_on_test_lots(
    reduced_vector_ids: List[str],
    df_faults: pd.DataFrame,
    df_die: pd.DataFrame
) -> Dict[str, Any]:
    """
    Audits the proposed reduced vector set against physical defective die in held-out test lots.
    Checks whether bridge and open defects would be missed because their fault_id was NOT activated
    by any of the retained vectors.
    """
    v_cols = [v for v in reduced_vector_ids if v in df_faults.columns]
    retained_matrix = df_faults[v_cols].to_numpy().astype(bool)
    retained_covered_faults = set(np.where(retained_matrix.any(axis=1))[0])
    
    # Filter to test split die
    is_test = (df_die["suggested_split"] == "test") if "suggested_split" in df_die.columns else (df_die["lot_id"].isin(["LOT11", "LOT12"]))
    df_test = df_die[is_test].copy()
    
    # Bridge and open defects have valid defect_fault_id in 0..1999
    bridge_open_test = df_test[df_test["defect_type"].isin(["bridge", "open_floating"])].copy()
    total_bridge_open = len(bridge_open_test)
    
    missed_die = []
    caught_count = 0
    for _, die in bridge_open_test.iterrows():
        fid = int(die["defect_fault_id"])
        if fid in retained_covered_faults:
            caught_count += 1
        else:
            missed_die.append({
                "die_uid": die["die_uid"],
                "lot_id": die["lot_id"],
                "wafer_id": int(die["wafer_id"]),
                "defect_type": die["defect_type"],
                "defect_fault_id": fid
            })
            
    escape_rate_pct = round(100.0 * len(missed_die) / max(1, total_bridge_open), 2)
    
    return {
        "test_lots_evaluated": ["LOT11", "LOT12"],
        "total_bridge_open_defective_die_in_test": total_bridge_open,
        "caught_by_reduced_set": caught_count,
        "missed_by_reduced_set": len(missed_die),
        "empirical_escape_rate_pct": escape_rate_pct,
        "missed_die_examples": missed_die[:20]
    }
