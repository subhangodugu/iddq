import hashlib
import os
import shutil
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import pandas as pd
from backend.app.core.config import settings

def calculate_checksum(file_path: str) -> str:
    """Computes SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()

def detect_file_type(df: Optional[pd.DataFrame], filename: str) -> str:
    """Infers the dataset or script format from columns and filename."""
    fname = filename.lower()
    if fname.endswith(".py") or "generator" in fname:
        return "dataset_generator"
    if fname.endswith(".md") or "readme" in fname:
        return "dataset_spec"
        
    if df is not None:
        cols = set(df.columns)
        if "die_uid" in cols and any("iddq_core_v" in c for c in cols):
            return "die_data"
        if "die_uid" in cols and any("i_t0.1ms_ua" in c for c in cols):
            return "transients"
        if "fault_id" in cols and "v01" in cols:
            return "fault_matrix"
        if "vector_id" in cols and "full_settle_time_ms" in cols:
            return "vector_info"
    
    if "die" in fname:
        return "die_data"
    if "trans" in fname:
        return "transients"
    if "matrix" in fname or "fault" in fname:
        return "fault_matrix"
    if "vector" in fname or "info" in fname:
        return "vector_info"
        
    return "unknown"

def copy_to_storage(source_path: str, destination_name: str) -> str:
    """Stores the original file immutably in the uploads directory."""
    dest_path = settings.UPLOADS_DIR / destination_name
    shutil.copy2(source_path, dest_path)
    return str(dest_path)

def load_csv_preview(file_path: str, max_rows: int = 15) -> Dict[str, Any]:
    """Returns row preview, column types, missing values, duplicates, and file stats."""
    file_size = os.path.getsize(file_path)
    checksum = calculate_checksum(file_path)
    
    # Handle scripts and markdown documents gracefully
    if file_path.lower().endswith((".py", ".md", ".txt")):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
        sample_lines = [l.rstrip() for l in all_lines[:max_rows]]
        f_type = "dataset_generator" if file_path.lower().endswith(".py") else "dataset_spec"
        return {
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "file_size_bytes": file_size,
            "checksum_sha256": checksum,
            "file_type": f_type,
            "total_rows": len(all_lines),
            "preview_columns": ["Line"],
            "column_types": {"Line": "string"},
            "missing_counts": {"Line": 0},
            "missing_percentages": {"Line": 0.0},
            "duplicate_rows_sample": 0,
            "numeric_summary": {},
            "preview_rows": [{"Line": l} for l in sample_lines],
        }

    # Read first 500 rows for fast statistical estimation without loading full file
    df_sample = pd.read_csv(file_path, nrows=500)
    df_preview = df_sample.head(max_rows)
    total_rows = sum(1 for _ in open(file_path, "r", encoding="utf-8", errors="ignore")) - 1
    
    col_types = {col: str(dtype) for col, dtype in df_sample.dtypes.items()}
    file_type = detect_file_type(df_sample, os.path.basename(file_path))

    
    missing_counts = {col: int(df_sample[col].isna().sum()) for col in df_sample.columns}
    missing_pcts = {col: round(float(df_sample[col].isna().mean() * 100), 2) for col in df_sample.columns}
    duplicate_count = int(df_sample.duplicated().sum())

    # Numeric summary statistics
    numeric_stats = {}
    for col in df_sample.select_dtypes(include=["number"]).columns[:10]:
        numeric_stats[col] = {
            "min": round(float(df_sample[col].min()), 2),
            "max": round(float(df_sample[col].max()), 2),
            "mean": round(float(df_sample[col].mean()), 2),
            "std": round(float(df_sample[col].std()), 2) if len(df_sample) > 1 else 0.0
        }
    
    return {
        "filename": os.path.basename(file_path),
        "file_path": file_path,
        "file_size_bytes": file_size,
        "checksum_sha256": checksum,
        "file_type": file_type,
        "total_rows": max(0, total_rows),
        "preview_columns": list(df_sample.columns),
        "column_types": col_types,
        "missing_counts": missing_counts,
        "missing_percentages": missing_pcts,
        "duplicate_rows_sample": duplicate_count,
        "numeric_summary": numeric_stats,
        "preview_rows": df_preview.to_dict(orient="records"),
    }

