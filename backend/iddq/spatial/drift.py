from typing import Dict, Any, List
import numpy as np
import pandas as pd

def calculate_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    num_bins: int = 10,
    epsilon: float = 1e-4
) -> float:
    """
    Calculates Population Stability Index (PSI) between expected (reference) and actual distributions.
    PSI = sum((actual_pct - expected_pct) * ln(actual_pct / expected_pct))
    """
    if len(expected) == 0 or len(actual) == 0:
        return 0.0
        
    # Determine bin edges from reference distribution
    quantiles = np.linspace(0, 100, num_bins + 1)
    bin_edges = np.percentile(expected, quantiles)
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf
    
    # Calculate counts
    exp_counts, _ = np.histogram(expected, bins=bin_edges)
    act_counts, _ = np.histogram(actual, bins=bin_edges)
    
    # Convert to proportions with smoothing
    exp_pct = exp_counts / max(1, len(expected)) + epsilon
    act_pct = act_counts / max(1, len(actual)) + epsilon
    
    # Normalize to sum to 1
    exp_pct /= exp_pct.sum()
    act_pct /= act_pct.sum()
    
    psi_val = np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct))
    return round(float(psi_val), 4)

def evaluate_lot_drift(
    df: pd.DataFrame,
    reference_lot: str = "LOT01",
    target_metric: str = "core_median_ua"
) -> Dict[str, Any]:
    """
    Computes drift metrics (PSI, median shift, IQR) across all lots relative to reference_lot.
    Flags process shifts (e.g. LOT12 alert).
    """
    if "lot_id" not in df.columns or target_metric not in df.columns:
        return {"error": "Missing lot_id or target_metric in dataset."}
        
    lots = sorted(df["lot_id"].unique())
    ref_vals = df.loc[df["lot_id"] == reference_lot, target_metric].dropna().to_numpy()
    if len(ref_vals) == 0:
        ref_vals = df[target_metric].dropna().to_numpy()[:2000]
        
    ref_median = float(np.median(ref_vals))
    
    lot_summaries = []
    drift_alert_lots = []
    
    for lot in lots:
        act_vals = df.loc[df["lot_id"] == lot, target_metric].dropna().to_numpy()
        if len(act_vals) == 0:
            continue
            
        psi = calculate_psi(ref_vals, act_vals)
        act_med = float(np.median(act_vals))
        shift_pct = round(100.0 * (act_med - ref_median) / max(1.0, ref_median), 1)
        
        # PSI status rule:
        # PSI < 0.1: STABLE (green)
        # 0.1 <= PSI < 0.25: MODERATE (amber)
        # PSI >= 0.25: SIGNIFICANT DRIFT / SHIFT (red)
        if psi < 0.10:
            status = "STABLE"
            color = "green"
        elif psi < 0.25:
            status = "MODERATE_SHIFT"
            color = "amber"
        else:
            status = "PROCESS_SHIFT_ALERT"
            color = "red"
            drift_alert_lots.append(lot)
            
        lot_summaries.append({
            "lot_id": lot,
            "die_count": len(act_vals),
            "median_ua": round(act_med, 1),
            "p05_ua": round(float(np.percentile(act_vals, 5)), 1),
            "p95_ua": round(float(np.percentile(act_vals, 95)), 1),
            "shift_pct_vs_ref": shift_pct,
            "psi": psi,
            "status": status,
            "status_color": color
        })
        
    return {
        "reference_lot": reference_lot,
        "reference_median_ua": round(ref_median, 1),
        "target_metric": target_metric,
        "lots_evaluated": len(lot_summaries),
        "drift_alert_lots": drift_alert_lots,
        "lot_drift_timeline": lot_summaries
    }
