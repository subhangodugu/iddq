from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    name: str = Field(..., example="FinFET Production IDDQ Optimization")
    description: Optional[str] = Field(None, example="Test time reduction benchmark for 12 lots")

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class DatasetResponse(BaseModel):
    id: int
    project_id: int
    file_type: str
    filename: str
    row_count: int
    file_size_bytes: int
    checksum_sha256: str
    status: str
    validation_report_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class AnalysisRunRequest(BaseModel):
    project_id: int = 1
    name: str = "Full End-to-End Optimization Run"
    fixed_limit_ua: float = 450.0
    ratio_quantile: float = 0.995
    settling_k_samples: int = 5
    settling_repeatability_ua: float = 5.0
    vector_target_coverage_pct: float = 100.0
    adaptive_risk_threshold: float = 0.20
    adaptive_audit_fraction: float = 0.05
    annual_volume: int = 10_000_000
    tester_cost_per_second: float = 0.05

class ModelRollbackRequest(BaseModel):
    model_type: str = "binary_defect_risk"
    target_version: str = "v1.0"
