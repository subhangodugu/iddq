from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

EXPECTED_DIE_COLS = [
    "die_uid", "lot_id", "wafer_id", "die_x", "die_y", "radius_norm", "edge_die",
    "reticle_pos", "tester_id", "site_id", "test_temp_c", "ring_osc_mhz", "fmax_mhz",
    "vmin_v", "leak_monitor_ua"
] + [f"iddq_core_v{i:02d}_ua" for i in range(1, 21)] + [f"iddq_io_v{i:02d}_ua" for i in range(1, 5)]

def validate_die_data(df: pd.DataFrame) -> Dict[str, Any]:
    """Validates iddq_die_data.csv against physical and statistical specifications."""
    errors: List[str] = []
    warnings: List[str] = []
    
    # 1. Required Columns
    missing_cols = [c for c in EXPECTED_DIE_COLS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required columns in die data: {missing_cols[:10]}")
        
    # 2. Duplicate die_uid
    if "die_uid" in df.columns:
        dups = df["die_uid"].duplicated().sum()
        if dups > 0:
            errors.append(f"Found {dups} duplicate die_uid values.")
            
    # 3. Missing/Null values
    null_counts = df.isnull().sum()
    total_nulls = int(null_counts.sum())
    if total_nulls > 0:
        errors.append(f"Dataset contains {total_nulls} null/missing values.")
        
    # 4. Valid numeric ranges
    if "radius_norm" in df.columns:
        if (df["radius_norm"] < 0).any() or (df["radius_norm"] > 1.2).any():
            warnings.append("radius_norm contains values outside normal [0.0, 1.0] wafer circle bounds.")
            
    if "test_temp_c" in df.columns:
        if (df["test_temp_c"] < 0).any() or (df["test_temp_c"] > 125).any():
            warnings.append("test_temp_c contains values outside typical test temperature range [0°C, 125°C].")
            
    # Check core currents
    core_cols = [f"iddq_core_v{i:02d}_ua" for i in range(1, 21) if f"iddq_core_v{i:02d}_ua" in df.columns]
    for col in core_cols:
        if (df[col] < 0).any():
            errors.append(f"Negative current detected in column {col}.")
            break
            
    # 5. Lot split check
    has_splits = "suggested_split" in df.columns
    split_counts = {}
    if has_splits:
        split_counts = df["suggested_split"].value_counts().to_dict()
        if "train" not in split_counts or "test" not in split_counts:
            warnings.append("suggested_split missing train or test partitions.")
            
    # 6. Defect label consistency
    has_ground_truth = "true_defect" in df.columns
    defect_stats = {}
    if has_ground_truth:
        defect_stats = {
            "total_defects": int(df["true_defect"].sum()),
            "defect_rate_pct": round(float(df["true_defect"].mean() * 100), 3),
            "defect_types": df["defect_type"].value_counts().to_dict() if "defect_type" in df.columns else {}
        }
        
    passed = len(errors) == 0
    return {
        "dataset_type": "die_data",
        "passed": passed,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "column_count": len(df.columns),
        "has_ground_truth": has_ground_truth,
        "has_splits": has_splits,
        "split_counts": split_counts,
        "defect_stats": defect_stats,
    }

def validate_transients(df: pd.DataFrame, df_die: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """Validates iddq_transients.csv against timing and settled target specs."""
    errors: List[str] = []
    warnings: List[str] = []
    
    required = ["die_uid", "vector_id", "settled_iddq_ua", "full_settle_time_ms"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        errors.append(f"Missing required transient columns: {missing}")
        
    sample_cols = [c for c in df.columns if c.startswith("i_t") and c.endswith("ms_ua")]
    if len(sample_cols) < 5:
        errors.append(f"Too few transient sample columns found ({len(sample_cols)} found, expected >= 5).")
        
    if df.isnull().sum().sum() > 0:
        errors.append(f"Transients data contains {df.isnull().sum().sum()} null values.")
        
    # Check join with die_data if provided
    join_coverage_pct = 100.0
    if df_die is not None and "die_uid" in df.columns and "die_uid" in df_die.columns:
        trans_die = set(df["die_uid"])
        main_die = set(df_die["die_uid"])
        overlap = trans_die.intersection(main_die)
        join_coverage_pct = round(100.0 * len(overlap) / max(1, len(trans_die)), 2)
        if join_coverage_pct < 100.0:
            errors.append(f"Only {join_coverage_pct}% of transient die IDs join with main die dataset.")
            
    passed = len(errors) == 0
    return {
        "dataset_type": "transients",
        "passed": passed,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "unique_die_count": int(df["die_uid"].nunique()) if "die_uid" in df.columns else 0,
        "sample_columns_count": len(sample_cols),
        "join_coverage_pct": join_coverage_pct,
    }

def validate_vector_info(df: pd.DataFrame) -> Dict[str, Any]:
    """Validates vector_info.csv."""
    errors = []
    warnings = []
    required = ["vector_id", "full_settle_time_ms", "apply_time_ms", "measure_time_ms"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        errors.append(f"Missing vector info columns: {missing}")
    return {
        "dataset_type": "vector_info",
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "vector_count": len(df),
    }

def validate_fault_matrix(df: pd.DataFrame) -> Dict[str, Any]:
    """Validates vector_fault_matrix.csv."""
    errors = []
    warnings = []
    if "fault_id" not in df.columns:
        errors.append("fault_id column missing from fault matrix.")
    vcols = [c for c in df.columns if c.startswith("v") and len(c) == 3]
    if len(vcols) < 5:
        errors.append(f"Too few vector columns in fault matrix: {len(vcols)}")
        
    return {
        "dataset_type": "fault_matrix",
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "fault_count": len(df),
        "vector_columns": vcols,
    }
