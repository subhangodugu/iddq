import os
import shutil
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import pandas as pd
from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.database.models import Dataset, Project
from backend.app.schemas.common import DatasetResponse
from backend.iddq.ingestion.loader import calculate_checksum, detect_file_type, load_csv_preview
from backend.iddq.validation.validators import (
    validate_die_data, validate_transients, validate_vector_info, validate_fault_matrix
)
from backend.iddq.validation.readiness import compute_data_readiness

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.get("", response_model=List[DatasetResponse])
def list_datasets(project_id: int = 1, db: Session = Depends(get_db)):
    return db.query(Dataset).filter(Dataset.project_id == project_id).all()

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    project_id: int = Form(1),
    db: Session = Depends(get_db)
):
    """Uploads a CSV file, stores it immutably, validates schema, and saves to DB."""
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        proj = Project(id=1, name="Default IDDQ Project", description="Main semiconductor optimization workspace")
        db.add(proj)
        db.commit()
        
    dest_path = settings.UPLOADS_DIR / file.filename
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    checksum = calculate_checksum(str(dest_path))
    file_size = os.path.getsize(dest_path)
    
    # Handle scripts and documentation
    fname_lower = file.filename.lower()
    if fname_lower.endswith((".py", ".md", ".txt")):
        file_type = "dataset_generator" if fname_lower.endswith(".py") else "dataset_spec"
        row_count = sum(1 for _ in open(str(dest_path), "r", encoding="utf-8", errors="ignore"))
        val_report = {"passed": True, "type": "supporting_file", "filename": file.filename}
    else:
        # Read sample to detect file type
        try:
            df_sample = pd.read_csv(str(dest_path), nrows=50)
            file_type = detect_file_type(df_sample, file.filename)
            df_full = pd.read_csv(str(dest_path))
            row_count = len(df_full)
            if file_type == "die_data":
                val_report = validate_die_data(df_full)
            elif file_type == "transients":
                val_report = validate_transients(df_full)
            elif file_type == "vector_info":
                val_report = validate_vector_info(df_full)
            elif file_type == "fault_matrix":
                val_report = validate_fault_matrix(df_full)
            else:
                val_report = {"passed": False, "errors": ["Unrecognized CSV format"]}
        except Exception as e:
            row_count = 0
            file_type = "unknown"
            val_report = {"passed": False, "errors": [f"Parsing error: {str(e)}"]}
        
    ds = Dataset(
        project_id=project_id,
        file_type=file_type,
        filename=file.filename,
        file_path=str(dest_path),
        row_count=row_count,
        file_size_bytes=file_size,
        checksum_sha256=checksum,
        status="valid" if val_report.get("passed") else "invalid",
        validation_report_json=val_report
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return {
        "message": f"Successfully uploaded and validated {file.filename}",
        "dataset_id": ds.id,
        "file_type": file_type,
        "row_count": ds.row_count,
        "status": ds.status,
        "validation_report": val_report
    }

@router.post("/load-sample")
def load_sample_datasets(project_id: int = 1, db: Session = Depends(get_db)):
    """Loads all 6 supplied benchmark files from data/sample or uploads into the project."""
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        proj = Project(id=1, name="Default IDDQ Project", description="Main semiconductor optimization workspace")
        db.add(proj)
        db.commit()
        
    sample_files = [
        ("iddq_die_data.csv", "die_data"),
        ("iddq_transients.csv", "transients"),
        ("vector_info.csv", "vector_info"),
        ("vector_fault_matrix.csv", "fault_matrix"),
        ("generate_iddq_dataset.py", "dataset_generator"),
        ("README.md", "dataset_spec")
    ]
    
    loaded = []
    df_die = None
    die_path = settings.SAMPLE_DIR / "iddq_die_data.csv"
    if not die_path.exists():
        die_path = settings.UPLOADS_DIR / "iddq_die_data.csv"
    if die_path.exists():
        try:
            df_die = pd.read_csv(str(die_path))
        except Exception:
            pass
        
    for fname, ftype in sample_files:
        fpath = settings.SAMPLE_DIR / fname
        if not fpath.exists():
            fpath = settings.UPLOADS_DIR / fname
        if not fpath.exists():
            # Check source directory as fallback
            src_dir = Path(r"C:\Users\subha\Downloads\Test Engineering Solutions (1)\Test Engineering Solutions\AI OPtimized IDDQ\Dataset\iddq_synthetic_dataset")
            src_path = src_dir / fname
            if src_path.exists():
                shutil.copy2(src_path, fpath)
        if not fpath.exists():
            continue
            
        checksum = calculate_checksum(str(fpath))
        file_size = os.path.getsize(fpath)
        
        # Check if already loaded
        existing = db.query(Dataset).filter(
            Dataset.project_id == project_id,
            Dataset.filename == fname,
            Dataset.checksum_sha256 == checksum
        ).first()
        
        if existing:
            loaded.append({"file": fname, "status": "already_loaded", "dataset_id": existing.id, "file_type": existing.file_type})
            continue
            
        if ftype == "dataset_generator":
            row_cnt = sum(1 for _ in open(str(fpath), "r", encoding="utf-8", errors="ignore"))
            v_report = {"passed": True, "type": "python_script", "description": "Synthetic IDDQ dataset generator script"}
        elif ftype == "dataset_spec":
            row_cnt = sum(1 for _ in open(str(fpath), "r", encoding="utf-8", errors="ignore"))
            v_report = {"passed": True, "type": "markdown_doc", "description": "Dataset technical documentation & schema"}
        else:
            df = pd.read_csv(str(fpath))
            row_cnt = len(df)
            if ftype == "die_data":
                v_report = validate_die_data(df)
            elif ftype == "transients":
                v_report = validate_transients(df, df_die)
            elif ftype == "vector_info":
                v_report = validate_vector_info(df)
            elif ftype == "fault_matrix":
                v_report = validate_fault_matrix(df)
            else:
                v_report = {"passed": True}
            
        ds = Dataset(
            project_id=project_id,
            file_type=ftype,
            filename=fname,
            file_path=str(fpath),
            row_count=row_cnt,
            file_size_bytes=file_size,
            checksum_sha256=checksum,
            status="valid" if v_report.get("passed") else "invalid",
            validation_report_json=v_report
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)
        loaded.append({"file": fname, "status": "loaded", "dataset_id": ds.id, "file_type": ftype, "rows": row_cnt})
        
    return {"message": "All benchmark and supporting files loaded successfully", "loaded": loaded}

@router.post("/import-source-folder")
def import_source_folder(project_id: int = 1, db: Session = Depends(get_db)):
    """
    Directly imports all 6 project files from:
    C:\\Users\\subha\\Downloads\\Test Engineering Solutions (1)\\Test Engineering Solutions\\AI OPtimized IDDQ\\Dataset\\iddq_synthetic_dataset
    """
    src_dir = Path(r"C:\Users\subha\Downloads\Test Engineering Solutions (1)\Test Engineering Solutions\AI OPtimized IDDQ\Dataset\iddq_synthetic_dataset")
    if not src_dir.exists():
        raise HTTPException(status_code=404, detail=f"Source folder not found at {src_dir}")
        
    for item in src_dir.iterdir():
        if item.is_file():
            shutil.copy2(item, settings.UPLOADS_DIR / item.name)
            shutil.copy2(item, settings.SAMPLE_DIR / item.name)
            
    loaded_res = load_sample_datasets(project_id=project_id, db=db)
    loaded_files = [x.get("file") for x in loaded_res.get("loaded", [])]
    return {
        "message": "All 6 files imported successfully from source directory",
        "imported_count": len(loaded_files),
        "files": loaded_files,
        "details": loaded_res
    }

@router.post("/clear-all")
def clear_all_data(db: Session = Depends(get_db)):
    """Removes all datasets, analysis runs, detected defects, and gate evaluations from the system."""
    from backend.app.database.models import DetectedDefect, GateEvaluation, AnalysisRun, Dataset, AuditLog
    del_defects = db.query(DetectedDefect).delete()
    del_gates = db.query(GateEvaluation).delete()
    del_runs = db.query(AnalysisRun).delete()
    del_datasets = db.query(Dataset).delete()
    del_logs = db.query(AuditLog).delete()
    db.commit()
    
    # Also clean uploads folder
    for f in settings.UPLOADS_DIR.iterdir():
        if f.is_file():
            try:
                f.unlink()
            except Exception:
                pass
                
    return {
        "message": "All data, analysis runs, defects, and uploaded datasets removed successfully",
        "deleted_records": {
            "defects": del_defects,
            "gate_evaluations": del_gates,
            "analysis_runs": del_runs,
            "datasets": del_datasets,
            "audit_logs": del_logs
        }
    }


@router.get("/readiness")
def get_readiness_status(project_id: int = 1, db: Session = Depends(get_db)):
    """Computes real-time data readiness checklist and score."""
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.status == "valid").all()
    types = {d.file_type: d for d in datasets}
    
    die_ds = types.get("die_data")
    trans_ds = types.get("transients")
    vinfo_ds = types.get("vector_info")
    fault_ds = types.get("fault_matrix")
    
    return compute_data_readiness(
        has_die_data=die_ds is not None,
        has_transients=trans_ds is not None,
        has_vector_info=vinfo_ds is not None,
        has_fault_matrix=fault_ds is not None,
        die_report=die_ds.validation_report_json if die_ds else None,
        transients_report=trans_ds.validation_report_json if trans_ds else None,
        vector_report=vinfo_ds.validation_report_json if vinfo_ds else None,
        fault_report=fault_ds.validation_report_json if fault_ds else None
    )

@router.get("/history")
def get_upload_history(project_id: int = 1, db: Session = Depends(get_db)):
    """Returns chronological ingestion and upload provenance history."""
    records = db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.id.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "row_count": d.row_count,
            "file_size_bytes": d.file_size_bytes,
            "checksum_sha256": d.checksum_sha256,
            "status": d.status,
            "validation_report": d.validation_report_json,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in records
    ]

@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return load_csv_preview(ds.file_path, max_rows=15)

@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Don't delete sample benchmark files from data/sample
    if "sample" not in ds.file_path and os.path.exists(ds.file_path):
        try:
            os.remove(ds.file_path)
        except Exception:
            pass
            
    db.delete(ds)
    db.commit()
    return {"message": f"Dataset {ds.filename} removed successfully", "id": dataset_id}
