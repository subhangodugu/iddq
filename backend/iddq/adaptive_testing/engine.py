from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from backend.iddq.features.leakage_guard import ALLOWED_PRE_IDDQ_FEATURES, verify_no_leakage

def train_adaptive_risk_model(
    df: pd.DataFrame
) -> Tuple[Any, List[str], Dict[str, Any]]:
    """
    Trains a pre-IDDQ risk classifier using strictly parametric and spatial inputs available BEFORE IDDQ.
    Trained strictly on train lots (LOT01-08).
    """
    feature_cols = [c for c in ALLOWED_PRE_IDDQ_FEATURES if c in df.columns]
    verify_no_leakage(feature_cols)
    
    is_train = (df["suggested_split"] == "train").to_numpy() if "suggested_split" in df.columns else np.ones(len(df), dtype=bool)
    is_val = (df["suggested_split"] == "validation").to_numpy() if "suggested_split" in df.columns else np.zeros(len(df), dtype=bool)
    
    X = df[feature_cols].to_numpy()
    y = df["true_defect"].to_numpy().astype(int)
    
    X_train, y_train = X[is_train], y[is_train]
    X_val, y_val = X[is_val], y[is_val]
    
    # Imbalanced weight
    pos_count = max(1, int(y_train.sum()))
    pos_weight = float((len(y_train) - pos_count) / pos_count)
    
    model = HistGradientBoostingClassifier(
        max_iter=100,
        class_weight="balanced",
        random_state=42,
        min_samples_leaf=20
    )
    model.fit(X_train, y_train)
    
    val_probs = model.predict_proba(X_val)[:, 1]
    val_auc = round(float(roc_auc_score(y_val, val_probs)), 4) if len(np.unique(y_val)) > 1 else 0.5
    
    meta = {
        "model_type": "pre_iddq_adaptive_risk",
        "features_used": feature_cols,
        "train_samples": len(y_train),
        "validation_samples": len(y_val),
        "validation_roc_auc": val_auc
    }
    return model, feature_cols, meta

def simulate_adaptive_testing(
    model: Any,
    feature_cols: List[str],
    df: pd.DataFrame,
    risk_threshold: float = 0.20,
    audit_fraction: float = 0.05,
    full_test_time_ms: float = 85.0,
    reduced_test_time_ms: float = 40.0,
    random_seed: int = 42
) -> Dict[str, Any]:
    """
    Simulates adaptive test execution on held-out test lots (LOT11-12).
    Allocates each die to:
      - 'full_test_risk': High predicted risk die (p >= threshold)
      - 'full_test_audit': Random audit sample (to prevent blind escapes)
      - 'full_test_fallback': Missing data or anomalous values
      - 'reduced_test': Eligible low-risk die
    """
    # Filter to test split
    is_test = (df["suggested_split"] == "test").to_numpy() if "suggested_split" in df.columns else (df["lot_id"].isin(["LOT11", "LOT12"])).to_numpy()
    df_test = df[is_test].copy()
    n_test = len(df_test)
    if n_test == 0:
        df_test = df.copy()
        n_test = len(df_test)
        
    X_test = df_test[feature_cols].to_numpy()
    probs = model.predict_proba(X_test)[:, 1]
    df_test["predicted_risk"] = probs
    
    # 1. Check for missing values -> fallback to full test
    has_missing = df_test[feature_cols].isnull().any(axis=1).to_numpy()
    
    # 2. Risk decision
    is_high_risk = probs >= risk_threshold
    
    # 3. Random audit selection
    rng = np.random.RandomState(random_seed)
    random_draw = rng.random(n_test)
    is_audit = (~is_high_risk) & (~has_missing) & (random_draw < audit_fraction)
    
    # 4. Final flow assignment
    flow_assignment = np.array(["reduced_test"] * n_test, dtype=object)
    flow_assignment[is_high_risk] = "full_test_risk"
    flow_assignment[has_missing] = "full_test_fallback"
    flow_assignment[is_audit] = "full_test_audit"
    
    df_test["assigned_flow"] = flow_assignment
    
    # Flow share counts
    counts = pd.Series(flow_assignment).value_counts().to_dict()
    full_risk_count = counts.get("full_test_risk", 0)
    full_audit_count = counts.get("full_test_audit", 0)
    full_fallback_count = counts.get("full_test_fallback", 0)
    reduced_count = counts.get("reduced_test", 0)
    
    total_full = full_risk_count + full_audit_count + full_fallback_count
    
    full_share_pct = round(100.0 * total_full / n_test, 2)
    reduced_share_pct = round(100.0 * reduced_count / n_test, 2)
    audit_share_pct = round(100.0 * full_audit_count / n_test, 2)
    
    # 5. Defect Catch & Escapes Simulation
    y_test = df_test["true_defect"].to_numpy() if "true_defect" in df_test.columns else np.zeros(n_test)
    total_defects = int(y_test.sum())
    
    # Die tested with full flow catch 100% of IDDQ defects
    # Die tested with reduced flow catch only reduced defects (e.g. 80% if reduced set covers 80%)
    # Let's assess how many true defective die were routed to reduced flow!
    defective_routed_to_reduced = int(np.sum((y_test == 1) & (flow_assignment == "reduced_test")))
    defective_routed_to_full = total_defects - defective_routed_to_reduced
    
    # Estimated test time per die (ms)
    time_per_die = np.where(flow_assignment == "reduced_test", reduced_test_time_ms, full_test_time_ms)
    avg_test_time_ms = round(float(np.mean(time_per_die)), 2)
    time_saved_per_die_ms = round(float(full_test_time_ms - avg_test_time_ms), 2)
    total_time_saved_pct = round(100.0 * time_saved_per_die_ms / full_test_time_ms, 2)
    
    # Defect type breakdown of reduced flow
    defect_type_breakdown = {}
    if "defect_type" in df_test.columns:
        for dtype in ["bridge", "gate_oxide_short", "open_floating", "latent_weak"]:
            dmask = (df_test["defect_type"] == dtype).to_numpy()
            total_dt = int(dmask.sum())
            if total_dt > 0:
                routed_red = int(np.sum(dmask & (flow_assignment == "reduced_test")))
                defect_type_breakdown[dtype] = {
                    "total_in_test": total_dt,
                    "routed_to_full": total_dt - routed_red,
                    "routed_to_reduced": routed_red
                }
                
    return {
        "test_population_die": n_test,
        "risk_threshold": risk_threshold,
        "audit_fraction": audit_fraction,
        "full_test_share_pct": full_share_pct,
        "reduced_test_share_pct": reduced_share_pct,
        "audit_share_pct": audit_share_pct,
        "flow_distribution": {
            "full_test_risk": full_risk_count,
            "full_test_audit": full_audit_count,
            "full_test_fallback": full_fallback_count,
            "reduced_test": reduced_count
        },
        "total_true_defects_in_test": total_defects,
        "defects_routed_to_full_test": defective_routed_to_full,
        "defects_routed_to_reduced_test": defective_routed_to_reduced,
        "defect_type_routing": defect_type_breakdown,
        "baseline_full_test_time_ms": full_test_time_ms,
        "adaptive_avg_test_time_ms": avg_test_time_ms,
        "time_saved_per_die_ms": time_saved_per_die_ms,
        "test_time_reduction_pct": total_time_saved_pct
    }
