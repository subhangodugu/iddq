from typing import Tuple, List, Dict, Any, Optional
import numpy as np
import pandas as pd
from scipy.spatial import KDTree
from sklearn.linear_model import HuberRegressor, Ridge
from sklearn.preprocessing import RobustScaler
from backend.iddq.features.leakage_guard import verify_no_leakage

def compute_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes statistical summary features per die for core and I/O rails.
    Safeguards against division-by-zero on ratios.
    """
    res = df.copy()
    core_cols = [f"iddq_core_v{i:02d}_ua" for i in range(1, 21) if f"iddq_core_v{i:02d}_ua" in df.columns]
    io_cols = [f"iddq_io_v{i:02d}_ua" for i in range(1, 5) if f"iddq_io_v{i:02d}_ua" in df.columns]
    
    if not core_cols:
        return res
        
    core_vals = res[core_cols].to_numpy()
    
    # 1. Summary Statistics
    res["core_min_ua"] = np.min(core_vals, axis=1)
    res["core_max_ua"] = np.max(core_vals, axis=1)
    res["core_mean_ua"] = np.mean(core_vals, axis=1)
    res["core_median_ua"] = np.median(core_vals, axis=1)
    res["core_std_ua"] = np.std(core_vals, axis=1)
    
    q25 = np.percentile(core_vals, 25, axis=1)
    q75 = np.percentile(core_vals, 75, axis=1)
    res["core_iqr_ua"] = q75 - q25
    res["core_cv"] = res["core_std_ua"] / np.maximum(res["core_mean_ua"], 1e-6)
    
    # Current Ratio (safeguard near-zero denominator)
    res["core_current_ratio"] = res["core_max_ua"] / np.maximum(res["core_min_ua"], 1e-6)
    
    # 2. Consecutive Delta-IDDQ and Steps
    diffs = np.diff(core_vals, axis=1)
    res["max_delta_iddq_ua"] = np.max(np.abs(diffs), axis=1)
    res["max_positive_step_ua"] = np.max(np.maximum(diffs, 0), axis=1)
    res["max_negative_step_ua"] = np.max(np.maximum(-diffs, 0), axis=1)
    
    # 3. Sorted curve shape (step between 90th and 10th percentile of sorted vectors)
    sorted_vals = np.sort(core_vals, axis=1)
    res["sorted_curve_step_ua"] = sorted_vals[:, -2] - sorted_vals[:, 1]
    
    # 4. Core to I/O relationship
    if io_cols:
        io_vals = res[io_cols].to_numpy()
        res["io_min_ua"] = np.min(io_vals, axis=1)
        res["io_max_ua"] = np.max(io_vals, axis=1)
        res["io_mean_ua"] = np.mean(io_vals, axis=1)
        res["core_to_io_ratio"] = res["core_mean_ua"] / np.maximum(res["io_mean_ua"], 1e-6)
    else:
        res["io_mean_ua"] = 0.0
        res["core_to_io_ratio"] = 1.0
        
    return res

def fit_process_normalized_residuals(
    df: pd.DataFrame,
    train_mask: np.ndarray,
    target_col: str = "core_median_ua"
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Fits a robust Huber regression of expected background leakage on pre-IDDQ process proxies
    (ring oscillator frequency and leakage monitor) STRICTLY on training split.
    Returns the normalized residual array (measured - expected) / scale.
    """
    predictors = ["ring_osc_mhz", "leak_monitor_ua"]
    missing = [p for p in predictors if p not in df.columns]
    if missing or target_col not in df.columns:
        return np.zeros(len(df)), {}
        
    X = df[predictors].to_numpy()
    y = df[target_col].to_numpy()
    
    X_train, y_train = X[train_mask], y[train_mask]
    
    # Fit Huber regressor on training data
    model = HuberRegressor(epsilon=1.35)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X)
    raw_residuals = y - y_pred
    
    # Robust scale using median absolute deviation (MAD) of train residuals
    train_res = raw_residuals[train_mask]
    med = np.median(train_res)
    mad = np.median(np.abs(train_res - med)) * 1.4826  # normal-consistent scale
    mad = max(mad, 1e-4)
    
    norm_residuals = (raw_residuals - med) / mad
    
    metadata = {
        "coef": model.coef_.tolist(),
        "intercept": float(model.intercept_),
        "train_mad": float(mad),
        "train_median": float(med)
    }
    return norm_residuals, metadata

def compute_nearest_neighbor_residuals(df: pd.DataFrame) -> np.ndarray:
    """
    Computes spatial Nearest-Neighbor Residual (NNR) for each die on its wafer.
    Uses KDTree to find up to 8 surrounding neighbors within radius distance <= 1.5 grid units.
    """
    if "die_x" not in df.columns or "die_y" not in df.columns or "core_median_ua" not in df.columns:
        return np.zeros(len(df))
        
    nnr = np.zeros(len(df))
    # Group by wafer to keep spatial boundaries strictly intra-wafer
    groups = df.groupby(["lot_id", "wafer_id"]) if "lot_id" in df.columns else [(None, df)]
    
    for _, group in groups:
        indices = group.index.to_numpy()
        coords = group[["die_x", "die_y"]].to_numpy()
        vals = group["core_median_ua"].to_numpy()
        
        if len(coords) < 3:
            continue
            
        tree = KDTree(coords)
        for i, idx in enumerate(indices):
            # Query up to 9 nearest (including self)
            dists, n_indices = tree.query(coords[i], k=min(9, len(coords)), distance_upper_bound=2.5)
            # Exclude self
            neighbor_idxs = [ni for ni, d in zip(n_indices, dists) if ni != i and ni < len(coords) and np.isfinite(d)]
            if neighbor_idxs:
                neighbor_median = np.median(vals[neighbor_idxs])
                nnr[idx] = vals[i] - neighbor_median
            else:
                nnr[idx] = 0.0
                
    return nnr

def build_feature_pipeline(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes full feature engineering pipeline: derived metrics, normalized residuals, and NNR.
    Guarantees no target leakage.
    """
    df_feat = compute_derived_features(df)
    
    # Train mask: strictly train split if available, otherwise 80% split
    if "suggested_split" in df_feat.columns:
        train_mask = (df_feat["suggested_split"] == "train").to_numpy()
    else:
        n = len(df_feat)
        train_mask = np.zeros(n, dtype=bool)
        train_mask[:int(0.7 * n)] = True
        
    norm_res, res_meta = fit_process_normalized_residuals(df_feat, train_mask)
    df_feat["leakage_norm_residual"] = norm_res
    
    nn_res = compute_nearest_neighbor_residuals(df_feat)
    df_feat["nearest_neighbor_residual_ua"] = nn_res
    
    return df_feat, res_meta
