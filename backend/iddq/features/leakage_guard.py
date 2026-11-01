"""
Anti-Leakage Guard Module
Enforces strict column whitelisting to guarantee no downstream outcome labels,
defect ground truth, or post-IDDQ measurements can leak into predictive models.
"""
from typing import List, Set
import pandas as pd

# Strict blacklist of labels and ground-truth oracle fields
FORBIDDEN_COLUMNS: Set[str] = {
    "true_defect",
    "defect_type",
    "defect_fault_id",
    "defect_current_ua",
    "fixed_limit_fail",
    "final_test_fail",
    "burn_in_fail",
    "field_return",
    "settled_iddq_ua"  # When used as a feature in settling prediction
}

# Strictly pre-IDDQ features allowed for Adaptive Testing
ALLOWED_PRE_IDDQ_FEATURES: List[str] = [
    "ring_osc_mhz",
    "fmax_mhz",
    "vmin_v",
    "leak_monitor_ua",
    "radius_norm",
    "edge_die",
    "reticle_pos",
    "die_x",
    "die_y",
    "test_temp_c"
]

def sanitize_features(df: pd.DataFrame, feature_cols: List[str]) -> List[str]:
    """Removes any prohibited label or downstream field from feature columns."""
    clean = [c for c in feature_cols if c not in FORBIDDEN_COLUMNS and c in df.columns]
    return clean

def verify_no_leakage(feature_cols: List[str]) -> None:
    """Raises ValueError if any forbidden column is present in feature_cols."""
    leaked = [c for c in feature_cols if c in FORBIDDEN_COLUMNS]
    if leaked:
        raise ValueError(f"CRITICAL LEAKAGE DETECTED: Features contain forbidden label columns: {leaked}")
