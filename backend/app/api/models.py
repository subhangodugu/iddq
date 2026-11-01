from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import ModelRegistry
from backend.app.schemas.common import ModelRollbackRequest
from backend.iddq.governance.registry import rollback_model_version

router = APIRouter(prefix="/models", tags=["models"])

@router.get("")
def list_models(db: Session = Depends(get_db)):
    return db.query(ModelRegistry).order_by(ModelRegistry.id.desc()).all()

@router.get("/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    m = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    return m

@router.post("/rollback")
def perform_rollback(req: ModelRollbackRequest, db: Session = Depends(get_db)):
    target = rollback_model_version(db, model_type=req.model_type, target_version=req.target_version)
    if not target:
        raise HTTPException(status_code=404, detail=f"Target version {req.target_version} for model {req.model_type} not found")
    return {
        "message": f"Successfully rolled back {req.model_type} to version {req.target_version}",
        "active_model_id": target.id,
        "version": target.version,
        "approval_status": target.approval_status
    }
