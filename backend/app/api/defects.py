from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
import io
import csv

from backend.app.database.session import get_db
from backend.app.database.models import DetectedDefect, AnalysisRun

router = APIRouter(prefix="/defects", tags=["defects"])

@router.get("")
def list_detected_defects(
    analysis_run_id: Optional[int] = Query(None),
    lot_id: Optional[str] = Query(None),
    wafer_id: Optional[int] = Query(None),
    detection_method: Optional[str] = Query(None),
    predicted_defect_class: Optional[str] = Query(None),
    status_category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Returns paginated detected defect records with filtering options across lots, wafers,
    methods, and status categories (CONFIRMED_DEFECT, MODEL_PREDICTED, STATISTICAL_ANOMALY, UNVERIFIED_SUSPECT).
    """
    # If no analysis_run_id provided, default to latest completed run
    if not analysis_run_id:
        latest = db.query(AnalysisRun).filter(AnalysisRun.status == "completed").order_by(AnalysisRun.id.desc()).first()
        if latest:
            analysis_run_id = latest.id

    query = db.query(DetectedDefect)
    if analysis_run_id:
        query = query.filter(DetectedDefect.analysis_run_id == analysis_run_id)
    if lot_id:
        query = query.filter(DetectedDefect.lot_id == lot_id)
    if wafer_id is not None:
        query = query.filter(DetectedDefect.wafer_id == wafer_id)
    if detection_method:
        query = query.filter(DetectedDefect.detection_method == detection_method)
    if predicted_defect_class:
        query = query.filter(DetectedDefect.predicted_defect_class == predicted_defect_class)
    if status_category:
        query = query.filter(DetectedDefect.status_category == status_category)

    total_count = query.count()
    offset = (page - 1) * limit
    items = query.order_by(DetectedDefect.risk_score.desc(), DetectedDefect.id.asc()).offset(offset).limit(limit).all()

    return {
        "analysis_run_id": analysis_run_id,
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "total_pages": (total_count + limit - 1) // limit if limit else 1,
        "items": [
            {
                "id": d.id,
                "die_uid": d.die_uid,
                "lot_id": d.lot_id,
                "wafer_id": d.wafer_id,
                "die_x": d.die_x,
                "die_y": d.die_y,
                "detection_method": d.detection_method,
                "predicted_defect_class": d.predicted_defect_class,
                "ground_truth_class": d.ground_truth_class,
                "status_category": d.status_category,
                "measured_iddq_ua": round(d.measured_iddq_ua, 2),
                "applicable_threshold": round(d.applicable_threshold, 2),
                "risk_score": round(d.risk_score, 3),
                "detection_explanation": d.detection_explanation,
                "dataset_version": d.dataset_version,
                "model_version": d.model_version,
                "created_at": d.created_at.isoformat() if d.created_at else None
            }
            for d in items
        ]
    }

@router.get("/summary")
def get_defects_summary(
    analysis_run_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated defect metrics by status category, method, and physical defect taxonomy.
    """
    if not analysis_run_id:
        latest = db.query(AnalysisRun).filter(AnalysisRun.status == "completed").order_by(AnalysisRun.id.desc()).first()
        if latest:
            analysis_run_id = latest.id

    if not analysis_run_id:
        return {"status": "empty", "message": "No analysis runs recorded yet."}

    all_defects = db.query(DetectedDefect).filter(DetectedDefect.analysis_run_id == analysis_run_id).all()

    by_status: Dict[str, int] = {}
    by_method: Dict[str, int] = {}
    by_class: Dict[str, int] = {}
    by_lot: Dict[str, int] = {}

    for d in all_defects:
        by_status[d.status_category] = by_status.get(d.status_category, 0) + 1
        by_method[d.detection_method] = by_method.get(d.detection_method, 0) + 1
        by_class[d.predicted_defect_class] = by_class.get(d.predicted_defect_class, 0) + 1
        by_lot[d.lot_id] = by_lot.get(d.lot_id, 0) + 1

    return {
        "analysis_run_id": analysis_run_id,
        "total_detected_instances": len(all_defects),
        "unique_flagged_dies": len(set(d.die_uid for d in all_defects)),
        "by_status_category": by_status,
        "by_detection_method": by_method,
        "by_predicted_class": by_class,
        "by_lot": by_lot
    }

@router.get("/export")
def export_defects_csv(
    analysis_run_id: Optional[int] = Query(None),
    lot_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Exports detected defect records as a downloadable CSV."""
    if not analysis_run_id:
        latest = db.query(AnalysisRun).filter(AnalysisRun.status == "completed").order_by(AnalysisRun.id.desc()).first()
        if latest:
            analysis_run_id = latest.id

    query = db.query(DetectedDefect)
    if analysis_run_id:
        query = query.filter(DetectedDefect.analysis_run_id == analysis_run_id)
    if lot_id:
        query = query.filter(DetectedDefect.lot_id == lot_id)

    items = query.order_by(DetectedDefect.risk_score.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "die_uid", "lot_id", "wafer_id", "die_x", "die_y",
        "detection_method", "predicted_defect_class", "ground_truth_class",
        "status_category", "measured_iddq_ua", "applicable_threshold",
        "risk_score", "detection_explanation", "created_at"
    ])
    for d in items:
        writer.writerow([
            d.die_uid, d.lot_id, d.wafer_id, d.die_x, d.die_y,
            d.detection_method, d.predicted_defect_class, d.ground_truth_class or "none",
            d.status_category, d.measured_iddq_ua, d.applicable_threshold,
            d.risk_score, d.detection_explanation, d.created_at.isoformat() if d.created_at else ""
        ])

    return PlainTextResponse(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=detected_defects_run_{analysis_run_id}.csv"}
    )
