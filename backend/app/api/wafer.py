from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import pandas as pd

from backend.app.database.session import get_db
from backend.app.api.die import get_active_features_df
from backend.iddq.spatial.wafer_map import get_wafer_map_data
from backend.iddq.spatial.drift import evaluate_lot_drift

router = APIRouter(prefix="/wafer", tags=["wafer"])

@router.get("/lots")
def get_available_lots_and_wafers(db: Session = Depends(get_db)):
    df = get_active_features_df(db)
    lots = sorted(df["lot_id"].unique().tolist()) if "lot_id" in df.columns else []
    lot_wafer_map = {}
    for l in lots:
        wafers = sorted(df[df["lot_id"] == l]["wafer_id"].unique().tolist())
        lot_wafer_map[l] = wafers
    return {
        "lots": lots,
        "lot_wafer_map": lot_wafer_map,
        "total_lots": len(lots)
    }

@router.get("/drift/timeline")
def get_drift_timeline(
    reference_lot: str = Query("LOT01"),
    metric: str = Query("core_median_ua"),
    db: Session = Depends(get_db)
):
    df = get_active_features_df(db)
    return evaluate_lot_drift(df, reference_lot=reference_lot, target_metric=metric)

@router.get("/{lot_id}/{wafer_id}")
def get_wafer_details(lot_id: str, wafer_id: int, db: Session = Depends(get_db)):
    df = get_active_features_df(db)
    return get_wafer_map_data(df, lot_id=lot_id, wafer_id=wafer_id)

