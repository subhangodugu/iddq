from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.covariance import MinCovDet
from sklearn.ensemble import IsolationForest
from backend.iddq.evaluation.metrics import compute_screen_metrics

def evaluate_all_screens(
    df: pd.DataFrame,
    fixed_limit_ua: float = 450.0,
    ratio_quantile: float = 0.995,
    delta_quantile: float = 0.995,
    norm_res_threshold: float = 3.0,
    isolation_forest_contamination: float = 0.025
) -> Dict[str, Any]:
    """
    Evaluates the 6 comparative screening approaches on the loaded die dataset.
    Fits unsupervised/normal baseline parameters strictly on clean training die.
    """
    has_labels = "true_defect" in df.columns
    y_true = df["true_defect"].to_numpy() if has_labels else np.zeros(len(df))
    
    # Train mask and clean die mask on train
    is_train = (df["suggested_split"] == "train").to_numpy() if "suggested_split" in df.columns else np.ones(len(df), dtype=bool)
    clean_train_mask = is_train & (y_true == 0) if has_labels else is_train
    
    results: Dict[str, Any] = {}
    
    # -------------------------------------------------------------
    # Screen 1: Legacy Fixed Limit Screen (core max > 450 uA)
    # -------------------------------------------------------------
    core_max = df["core_max_ua"].to_numpy() if "core_max_ua" in df.columns else df[[f"iddq_core_v{i:02d}_ua" for i in range(1, 21)]].max(axis=1).to_numpy()
    pred_fixed = (core_max > fixed_limit_ua).astype(int)
    results["fixed_limit"] = compute_screen_metrics(
        y_true, pred_fixed, df,
        screen_name="Legacy Fixed Limit",
        threshold_desc=f"Core Max IDDQ > {fixed_limit_ua:.1f} µA"
    )
    
    # -------------------------------------------------------------
    # Screen 2: Current Ratio Screen (Max/Min)
    # -------------------------------------------------------------
    if "core_current_ratio" in df.columns:
        ratio_vals = df["core_current_ratio"].to_numpy()
    else:
        core_min = df[[f"iddq_core_v{i:02d}_ua" for i in range(1, 21)]].min(axis=1).to_numpy()
        ratio_vals = core_max / np.maximum(core_min, 1e-6)
        
    ratio_thresh = float(np.quantile(ratio_vals[clean_train_mask], ratio_quantile))
    pred_ratio = (ratio_vals > ratio_thresh).astype(int)
    results["current_ratio"] = compute_screen_metrics(
        y_true, pred_ratio, df,
        screen_name="Current Ratio (Max/Min)",
        threshold_desc=f"Ratio > {ratio_thresh:.3f} ({ratio_quantile*100:.1f}th quantile of clean train die)"
    )
    
    # -------------------------------------------------------------
    # Screen 3: Delta-IDDQ Screen
    # -------------------------------------------------------------
    if "max_delta_iddq_ua" in df.columns:
        delta_vals = df["max_delta_iddq_ua"].to_numpy()
    else:
        diffs = np.diff(df[[f"iddq_core_v{i:02d}_ua" for i in range(1, 21)]].to_numpy(), axis=1)
        delta_vals = np.max(np.abs(diffs), axis=1)
        
    delta_thresh = float(np.quantile(delta_vals[clean_train_mask], delta_quantile))
    pred_delta = (delta_vals > delta_thresh).astype(int)
    results["delta_iddq"] = compute_screen_metrics(
        y_true, pred_delta, df,
        screen_name="Delta-IDDQ Step",
        threshold_desc=f"Max Delta-IDDQ > {delta_thresh:.2f} µA ({delta_quantile*100:.1f}th quantile)"
    )
    
    # -------------------------------------------------------------
    # Screen 4: Leakage-Normalized Residual Screen
    # -------------------------------------------------------------
    if "leakage_norm_residual" in df.columns:
        norm_res_vals = np.abs(df["leakage_norm_residual"].to_numpy())
        pred_norm_res = (norm_res_vals > norm_res_threshold).astype(int)
        results["normalized_residual"] = compute_screen_metrics(
            y_true, pred_norm_res, df,
            screen_name="Leakage-Normalized Residual",
            threshold_desc=f"|Residual| > {norm_res_threshold:.1f} σ (Huber process-normalized)"
        )
        
    # -------------------------------------------------------------
    # Screen 5: Robust Mahalanobis Distance Screen
    # -------------------------------------------------------------
    core_cols = [f"iddq_core_v{i:02d}_ua" for i in range(1, 21) if f"iddq_core_v{i:02d}_ua" in df.columns]
    if len(core_cols) >= 5:
        X_core = df[core_cols].to_numpy()
        # Fit on sample of clean train die for speed and robustness
        clean_train_idx = np.where(clean_train_mask)[0]
        sample_idx = np.random.RandomState(42).choice(clean_train_idx, min(2500, len(clean_train_idx)), replace=False)
        
        try:
            mcd = MinCovDet(support_fraction=0.85, random_state=42)
            mcd.fit(X_core[sample_idx])
            mahal_dist = mcd.mahalanobis(X_core)
            m_thresh = float(np.quantile(mahal_dist[clean_train_mask], 0.99))
            pred_mahal = (mahal_dist > m_thresh).astype(int)
            results["mahalanobis"] = compute_screen_metrics(
                y_true, pred_mahal, df,
                screen_name="Robust Mahalanobis Distance",
                threshold_desc=f"MCD Distance > {m_thresh:.1f} (99th quantile of clean baseline)"
            )
        except Exception as e:
            results["mahalanobis"] = {"error": str(e), "screen_name": "Robust Mahalanobis Distance"}
            
    # -------------------------------------------------------------
    # Screen 6: Isolation Forest Anomaly Screen
    # -------------------------------------------------------------
    feat_candidates = ["core_cv", "core_current_ratio", "max_delta_iddq_ua", "leakage_norm_residual", "core_iqr_ua"]
    if_cols = [c for c in feat_candidates if c in df.columns]
    if if_cols:
        X_if = df[if_cols].to_numpy()
        iso = IsolationForest(contamination=isolation_forest_contamination, random_state=42, n_jobs=-1)
        iso.fit(X_if[clean_train_mask])
        pred_iso = (iso.predict(X_if) == -1).astype(int)
        results["isolation_forest"] = compute_screen_metrics(
            y_true, pred_iso, df,
            screen_name="Isolation Forest Anomaly Screen",
            threshold_desc=f"Contamination={isolation_forest_contamination:.3f} on multivariable signature"
        )
        
    return results
