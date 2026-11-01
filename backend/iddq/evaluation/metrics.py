from typing import Dict, Any, Optional
import numpy as np
import pandas as pd

def compute_screen_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    df: Optional[pd.DataFrame] = None,
    screen_name: str = "screen",
    threshold_desc: str = ""
) -> Dict[str, Any]:
    """
    Computes rigorous semiconductor screening metrics:
    TP, FP, FN, TN, Recall, Precision, Specificity, F1, Overkill Rate, Escapes,
    plus breakdowns by defect type and by lot (with LOT12 focus).
    """
    y_t = np.asarray(y_true).astype(int)
    y_p = np.asarray(y_pred).astype(int)
    
    tp = int(np.sum((y_t == 1) & (y_p == 1)))
    fp = int(np.sum((y_t == 0) & (y_p == 1)))
    fn = int(np.sum((y_t == 1) & (y_p == 0)))
    tn = int(np.sum((y_t == 0) & (y_p == 0)))
    
    total = len(y_t)
    total_pos = max(1, tp + fn)
    total_neg = max(1, tn + fp)
    
    recall = round(float(tp / total_pos), 4)
    precision = round(float(tp / max(1, tp + fp)), 4)
    specificity = round(float(tn / total_neg), 4)
    fpr = round(float(fp / total_neg), 4)
    overkill_rate = fpr  # Fraction of good die failed
    f1 = round(float(2 * tp / max(1, 2 * tp + fp + fn)), 4)
    
    res: Dict[str, Any] = {
        "screen_name": screen_name,
        "threshold_desc": threshold_desc,
        "total_evaluated": total,
        "flagged_count": tp + fp,
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "escapes": fn,
        "recall": recall,
        "precision": precision,
        "specificity": specificity,
        "f1_score": f1,
        "false_positive_rate": fpr,
        "overkill_rate": overkill_rate,
        "confusion_matrix": {
            "tp": tp, "fp": fp, "fn": fn, "tn": tn
        }
    }
    
    # Detailed breakdowns if dataframe provided
    if df is not None:
        # 1. Defect Type Breakdown
        if "defect_type" in df.columns:
            dt_perf = {}
            for dtype in ["bridge", "gate_oxide_short", "open_floating", "latent_weak"]:
                sub_mask = (df["defect_type"] == dtype).to_numpy()
                sub_total = int(sub_mask.sum())
                if sub_total > 0:
                    sub_caught = int(np.sum(y_p[sub_mask] == 1))
                    dt_perf[dtype] = {
                        "total": sub_total,
                        "caught": sub_caught,
                        "recall": round(sub_caught / sub_total, 4)
                    }
            res["performance_by_defect_type"] = dt_perf
            
        # 2. Lot-by-Lot Breakdown (Highlighting LOT12)
        if "lot_id" in df.columns:
            lot_perf = {}
            for lot in sorted(df["lot_id"].unique()):
                l_mask = (df["lot_id"] == lot).to_numpy()
                l_yt = y_t[l_mask]
                l_yp = y_p[l_mask]
                l_tp = int(np.sum((l_yt == 1) & (l_yp == 1)))
                l_fp = int(np.sum((l_yt == 0) & (l_yp == 1)))
                l_fn = int(np.sum((l_yt == 1) & (l_yp == 0)))
                l_tn = int(np.sum((l_yt == 0) & (l_yp == 0)))
                lot_perf[lot] = {
                    "total": int(l_mask.sum()),
                    "flagged": l_tp + l_fp,
                    "tp": l_tp,
                    "fp": l_fp,
                    "fn": l_fn,
                    "overkill": l_fp,
                    "recall": round(l_tp / max(1, l_tp + l_fn), 4)
                }
            res["performance_by_lot"] = lot_perf
            if "LOT12" in lot_perf:
                res["lot12_summary"] = lot_perf["LOT12"]
                
    return res
