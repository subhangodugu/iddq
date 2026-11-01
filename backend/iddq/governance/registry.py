from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.database.models import ModelRegistry, AuditLog

def register_model_version(
    db: Session,
    name: str,
    model_type: str,
    version: str,
    algorithm: str,
    feature_schema: List[str],
    metrics: Dict[str, Any],
    artifact_path: Optional[str] = None
) -> ModelRegistry:
    """Registers a new versioned model artifact in the registry."""
    # Deactivate older models of same type if desired, or keep track of versions
    entry = ModelRegistry(
        name=name,
        model_type=model_type,
        version=version,
        algorithm=algorithm,
        feature_schema_json={"features": feature_schema, "count": len(feature_schema)},
        metrics_json=metrics,
        artifact_path=artifact_path,
        is_active=True,
        approval_status="shadow_approved"
    )
    db.add(entry)
    
    # Audit log
    log = AuditLog(
        event_type="MODEL_REGISTERED",
        entity_type="ModelRegistry",
        entity_id=f"{model_type}:{version}",
        details_json={"name": name, "algorithm": algorithm, "version": version}
    )
    db.add(log)
    db.commit()
    db.refresh(entry)
    return entry

def rollback_model_version(
    db: Session,
    model_type: str,
    target_version: str
) -> Optional[ModelRegistry]:
    """Rolls back the active model to a prior approved version."""
    models = db.query(ModelRegistry).filter(ModelRegistry.model_type == model_type).all()
    target = None
    for m in models:
        if m.version == target_version:
            m.is_active = True
            m.approval_status = "production_approved"
            target = m
        else:
            m.is_active = False
            
    if target:
        log = AuditLog(
            event_type="MODEL_ROLLBACK",
            entity_type="ModelRegistry",
            entity_id=f"{model_type}:{target_version}",
            details_json={"rolled_back_to": target_version}
        )
        db.add(log)
        db.commit()
        db.refresh(target)
    return target
