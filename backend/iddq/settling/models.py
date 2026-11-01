from typing import Dict, Any, List, Tuple, Optional
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

def train_settling_predictor(
    df_trans: pd.DataFrame,
    k_samples: int = 5,
    repeatability_ua: float = 5.0,
    save_path: Optional[str] = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Trains early-sample settling-time predictors (median and quantile bounds q05, q95).
    k_samples: number of early samples used (e.g. 5 means 0.1ms to 0.5ms).
    """
    sample_cols = [f"i_t{t:.1f}ms_ua" for t in np.round(np.arange(0.1, 0.1 * k_samples + 0.01, 0.1), 1)]
    missing = [c for c in sample_cols if c not in df_trans.columns]
    if missing:
        raise ValueError(f"Missing required early sample columns: {missing}")
        
    target_col = "settled_iddq_ua"
    if target_col not in df_trans.columns:
        raise ValueError(f"Target column '{target_col}' missing from transients data.")
        
    df_clean = df_trans.dropna(subset=sample_cols + [target_col]).copy()
    
    # Feature engineering for settling:
    # 1. Early sample values
    # 2. Early slopes (diff between consecutive samples)
    # 3. Ratio between first and latest early sample
    X_samples = df_clean[sample_cols].to_numpy()
    slopes = np.diff(X_samples, axis=1)
    decay_ratio = X_samples[:, -1] / np.maximum(X_samples[:, 0], 1e-4)
    
    X_features = np.column_stack([
        X_samples,
        slopes,
        decay_ratio,
        df_clean["vector_id"].to_numpy(),
        df_clean["full_settle_time_ms"].to_numpy()
    ])
    
    y = df_clean[target_col].to_numpy()
    
    # Train / Val / Test split based on suggested_split
    if "suggested_split" in df_clean.columns:
        train_mask = (df_clean["suggested_split"] == "train").to_numpy()
        test_mask = (df_clean["suggested_split"] == "test").to_numpy()
    else:
        n = len(df_clean)
        train_mask = np.zeros(n, dtype=bool)
        train_mask[:int(0.7 * n)] = True
        test_mask = ~train_mask
        
    X_train, y_train = X_features[train_mask], y[train_mask]
    X_test, y_test = X_features[test_mask], y[test_mask]
    
    # 1. Baseline Predictor: Latest early sample directly
    y_base_pred = X_test[:, len(sample_cols) - 1]
    base_mae = round(float(mean_absolute_error(y_test, y_base_pred)), 3)
    base_rmse = round(float(np.sqrt(mean_squared_error(y_test, y_base_pred))), 3)
    
    # 2. Median Regressor (Gradient Boosting)
    reg_median = HistGradientBoostingRegressor(loss="squared_error", max_iter=120, random_state=42)
    reg_median.fit(X_train, y_train)
    y_pred_median = reg_median.predict(X_test)
    
    ml_mae = round(float(mean_absolute_error(y_test, y_pred_median)), 3)
    ml_rmse = round(float(np.sqrt(mean_squared_error(y_test, y_pred_median))), 3)
    
    # 3. Quantile Regressors for Calibrated Prediction Intervals (q=0.05 and q=0.95)
    reg_q05 = HistGradientBoostingRegressor(loss="quantile", quantile=0.05, max_iter=100, random_state=42)
    reg_q95 = HistGradientBoostingRegressor(loss="quantile", quantile=0.95, max_iter=100, random_state=42)
    reg_q05.fit(X_train, y_train)
    reg_q95.fit(X_train, y_train)
    
    lower_bounds = reg_q05.predict(X_test)
    upper_bounds = reg_q95.predict(X_test)
    
    interval_widths = upper_bounds - lower_bounds
    mean_width = round(float(np.mean(interval_widths)), 3)
    coverage = round(float(np.mean((y_test >= lower_bounds) & (y_test <= upper_bounds)) * 100), 2)
    
    # 4. Guard-Band Early Termination Evaluation
    # If interval_width <= repeatability_ua, safe to early terminate!
    # Early sample time waited = k_samples * 0.1 ms
    # Programmed settle wait = full_settle_time_ms
    full_settle_times = df_clean.loc[test_mask, "full_settle_time_ms"].to_numpy()
    early_wait_ms = k_samples * 0.1
    
    safe_to_shorten = interval_widths <= repeatability_ua
    early_term_share = round(float(np.mean(safe_to_shorten) * 100), 2)
    
    # Time saved on safe predictions (ms)
    time_saved_per_vector_ms = np.where(safe_to_shorten, np.maximum(0, full_settle_times - early_wait_ms), 0.0)
    avg_time_saved_ms = round(float(np.mean(time_saved_per_vector_ms)), 3)
    
    # Error on early terminated vs full wait
    mae_shortened = round(float(mean_absolute_error(y_test[safe_to_shorten], y_pred_median[safe_to_shorten])), 3) if np.any(safe_to_shorten) else 0.0
    
    # Extract actual real transient curve from representative die in test set for charting
    clean_test = df_clean[test_mask]
    real_curve = []
    rep_uid = "N/A"
    rep_vec = 1
    if len(clean_test) > 0:
        rep_die = clean_test.iloc[0]
        rep_uid = str(rep_die.get("die_uid", "L03W04X18Y09"))
        rep_vec = int(rep_die.get("vector_id", 1))
        time_cols_all = [c for c in df_clean.columns if c.startswith("i_t") and c.endswith("ms_ua")]
        time_cols_sorted = sorted(time_cols_all, key=lambda c: float(c.replace("i_t", "").replace("ms_ua", "")))
        for c in time_cols_sorted:
            t_val = float(c.replace("i_t", "").replace("ms_ua", ""))
            real_curve.append({
                "time_ms": f"{t_val:.1f} ms",
                "t_num": t_val,
                "current_ua": round(float(rep_die[c]), 2),
                "lower_bound_ua": round(max(0.0, float(rep_die[c]) - 0.5 * mean_width), 2),
                "upper_bound_ua": round(float(rep_die[c]) + 0.5 * mean_width, 2),
                "settled_target_ua": round(float(rep_die[target_col]), 2)
            })

    models = {
        "median": reg_median,
        "q05": reg_q05,
        "q95": reg_q95,
        "sample_cols": sample_cols,
        "k_samples": k_samples
    }
    
    evaluation = {
        "k_samples": k_samples,
        "early_wait_time_ms": round(early_wait_ms, 2),
        "baseline_mae_ua": base_mae,
        "baseline_rmse_ua": base_rmse,
        "ml_mae_ua": ml_mae,
        "ml_rmse_ua": ml_rmse,
        "interval_coverage_pct": coverage,
        "mean_interval_width_ua": mean_width,
        "repeatability_tolerance_ua": repeatability_ua,
        "safe_early_termination_pct": early_term_share,
        "avg_settle_time_saved_ms": avg_time_saved_ms,
        "mae_on_shortened_predictions_ua": mae_shortened,
        "sample_count": len(y_test),
        "representative_die_uid": rep_uid,
        "representative_vector_id": rep_vec,
        "real_transient_curve": real_curve
    }
    
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        joblib.dump({"models": models, "evaluation": evaluation}, save_path)
        
    return models, evaluation

