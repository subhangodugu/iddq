from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    analysis_runs = relationship("AnalysisRun", back_populates="project", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_type = Column(String(64), nullable=False)  # die_data, transients, vector_info, fault_matrix
    filename = Column(String(256), nullable=False)
    file_path = Column(String(512), nullable=False)
    row_count = Column(Integer, default=0)
    file_size_bytes = Column(Integer, default=0)
    checksum_sha256 = Column(String(64), nullable=False)
    status = Column(String(32), default="pending")  # pending, valid, invalid, processing
    validation_report_json = Column(JSON, nullable=True)
    readiness_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="datasets")

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(128), nullable=False)
    status = Column(String(32), default="completed")  # running, completed, failed
    parameters_json = Column(JSON, nullable=True)
    results_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    project = relationship("Project", back_populates="analysis_runs")
    gate_evaluations = relationship("GateEvaluation", back_populates="analysis_run", cascade="all, delete-orphan")

class ModelRegistry(Base):
    __tablename__ = "model_registry"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    model_type = Column(String(64), nullable=False)  # defect_risk, defect_taxonomy, settling, adaptive_risk
    version = Column(String(32), nullable=False)
    algorithm = Column(String(64), nullable=False)
    feature_schema_json = Column(JSON, nullable=True)
    hyperparameters_json = Column(JSON, nullable=True)
    metrics_json = Column(JSON, nullable=True)
    artifact_path = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    approval_status = Column(String(32), default="shadow_approved")  # pending, shadow_approved, production_approved, rejected, rolled_back
    created_at = Column(DateTime, default=datetime.utcnow)

class GateEvaluation(Base):
    __tablename__ = "gate_evaluations"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_run_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    gate_id = Column(String(32), nullable=False)  # GATE_1, GATE_2, GATE_3
    gate_name = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False)  # PASSED, FAILED, BLOCKED
    summary = Column(Text, nullable=True)
    criteria_json = Column(JSON, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)
    
    analysis_run = relationship("AnalysisRun", back_populates="gate_evaluations")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(128), nullable=True)
    details_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DetectedDefect(Base):
    __tablename__ = "detected_defects"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_run_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    die_uid = Column(String(64), nullable=False, index=True)
    lot_id = Column(String(32), nullable=False, index=True)
    wafer_id = Column(Integer, nullable=False, index=True)
    die_x = Column(Integer, nullable=False)
    die_y = Column(Integer, nullable=False)
    detection_method = Column(String(64), nullable=False)  # fixed_limit, current_ratio, delta_iddq, normalized_residual, mahalanobis, isolation_forest, supervised_gbdt
    predicted_defect_class = Column(String(64), nullable=False)  # bridge, gate_oxide_short, open_floating, weak_latent, normal
    ground_truth_class = Column(String(64), nullable=True)  # bridge, gate_oxide_short, open_floating, weak_latent, none, or None
    status_category = Column(String(32), nullable=False)  # CONFIRMED_DEFECT, MODEL_PREDICTED, STATISTICAL_ANOMALY, UNVERIFIED_SUSPECT
    measured_iddq_ua = Column(Float, nullable=False)
    applicable_threshold = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    detection_explanation = Column(Text, nullable=False)
    dataset_version = Column(String(64), default="v1.0")
    model_version = Column(String(64), default="v1.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    analysis_run = relationship("AnalysisRun", backref="detected_defects")

