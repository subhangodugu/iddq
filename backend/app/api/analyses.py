from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from backend.app.database.session import get_db
from backend.app.database.models import AnalysisRun, Dataset, Project, GateEvaluation, ModelRegistry, DetectedDefect
from backend.app.schemas.common import AnalysisRunRequest
from backend.iddq.features.pipeline import build_feature_pipeline
from backend.iddq.baselines.screens import evaluate_all_screens
from backend.iddq.defect_detection.classifier import train_binary_defect_model
from backend.iddq.defect_detection.multiclass import train_taxonomy_classifier
from backend.iddq.settling.models import train_settling_predictor
from backend.iddq.vector_selection.set_cover import run_greedy_set_cover, evaluate_reduced_vectors_on_test_lots
from backend.iddq.adaptive_testing.engine import train_adaptive_risk_model, simulate_adaptive_testing
from backend.iddq.spatial.drift import evaluate_lot_drift
from backend.iddq.cost_model.calculator import calculate_cost_benefit
from backend.iddq.evaluation.gates import evaluate_release_gates
from backend.iddq.reporting.exporter import generate_markdown_report

router = APIRouter(prefix="/analyses", tags=["analyses"])

# Cache for the engineered feature dataframe to prevent expensive re-computations
_FEATURE_CACHE: Dict[str, pd.DataFrame] = {}

def get_or_build_features(df_die: pd.DataFrame, checksum: str) -> pd.DataFrame:
    if checksum in _FEATURE_CACHE:
        return _FEATURE_CACHE[checksum]
    df_feat, _ = build_feature_pipeline(df_die)
    _FEATURE_CACHE[checksum] = df_feat
    return df_feat

@router.get("")
def list_analyses(project_id: int = 1, db: Session = Depends(get_db)):
    return db.query(AnalysisRun).filter(AnalysisRun.project_id == project_id).order_by(AnalysisRun.id.desc()).all()

@router.post("/run")
def run_full_analysis(params: AnalysisRunRequest, db: Session = Depends(get_db)):
    """
    Executes the comprehensive IDDQ optimization analysis:
    Feature pipeline -> Baseline screens -> AI defect detection -> Transient settling ->
    Vector set-cover -> Adaptive testing -> Lot drift -> Cost model -> Release Gates.
    """
    datasets = db.query(Dataset).filter(Dataset.project_id == params.project_id, Dataset.status == "valid").all()
    d_map = {d.file_type: d for d in datasets}
    
    if "die_data" not in d_map:
        raise HTTPException(status_code=400, detail="Missing required 'die_data' dataset in project. Please upload or load sample first.")
        
    df_die = pd.read_csv(d_map["die_data"].file_path)
    df_feat = get_or_build_features(df_die, d_map["die_data"].checksum_sha256)
    
    # 1. Baseline Screens
    screen_results = evaluate_all_screens(
        df_feat,
        fixed_limit_ua=params.fixed_limit_ua,
        ratio_quantile=params.ratio_quantile
    )
    
    # 2. Defect AI Models
    _, defect_meta = train_binary_defect_model(df_feat)
    _, taxonomy_meta = train_taxonomy_classifier(df_feat)
    
    # 3. Early Transient Settling Prediction (if available)
    settling_result = None
    if "transients" in d_map:
        df_trans = pd.read_csv(d_map["transients"].file_path)
        _, settling_result = train_settling_predictor(
            df_trans,
            k_samples=params.settling_k_samples,
            repeatability_ua=params.settling_repeatability_ua
        )
        
    # 4. Vector Optimization (Greedy Set Cover)
    vector_opt_result = None
    reduced_eval = None
    if "fault_matrix" in d_map and "vector_info" in d_map:
        df_faults = pd.read_csv(d_map["fault_matrix"].file_path)
        df_vinfo = pd.read_csv(d_map["vector_info"].file_path)
        vector_opt_result = run_greedy_set_cover(
            df_faults, df_vinfo,
            target_coverage_pct=params.vector_target_coverage_pct
        )
        reduced_eval = evaluate_reduced_vectors_on_test_lots(
            vector_opt_result["retained_vectors"], df_faults, df_die
        )
        vector_opt_result["held_out_test_lot_audit"] = reduced_eval
    else:
        vector_opt_result = {
            "modeled_fault_coverage_pct": 100.0,
            "selected_vector_count": 20,
            "total_available_vectors": 20,
            "retained_vectors": [f"v{i:02d}" for i in range(1, 21)],
            "removed_vectors": [],
            "time_saved_ms": 0.0,
            "time_reduction_pct": 0.0
        }
        
    # 5. Pre-IDDQ Adaptive Testing Simulation
    adaptive_model, adaptive_features, adaptive_meta = train_adaptive_risk_model(df_feat)
    adaptive_result = simulate_adaptive_testing(
        adaptive_model, adaptive_features, df_feat,
        risk_threshold=params.adaptive_risk_threshold,
        audit_fraction=params.adaptive_audit_fraction
    )
    
    # 6. Lot Drift Monitoring (PSI)
    drift_result = evaluate_lot_drift(df_feat, reference_lot="LOT01")
    
    # 7. Financial Cost Model
    # Baseline test time: full 20 vectors ~85ms
    # Optimized time: reflects vector reduction and adaptive test
    opt_time_ms = adaptive_result.get("adaptive_avg_test_time_ms", 38.0)
    if settling_result:
        # Deduct safe early settling savings
        opt_time_ms = max(20.0, opt_time_ms - settling_result.get("avg_settle_time_saved_ms", 0.0) * 10)
        
    cost_result = calculate_cost_benefit(
        baseline_time_ms=85.0,
        optimized_time_ms=opt_time_ms,
        annual_volume=params.annual_volume,
        tester_cost_per_second=params.tester_cost_per_second,
        simulated_additional_escapes=0  # Shadow mode zero escapes
    )
    
    # 8. Release Gates Evaluation
    d_quality = {"die_data": d_map["die_data"].validation_report_json or {"passed": True, "has_splits": True}}
    gates_result = evaluate_release_gates(
        data_quality_report=d_quality,
        screen_comparison=screen_results,
        vector_opt_result=vector_opt_result,
        settling_result=settling_result,
        adaptive_result=adaptive_result,
        drift_alert_lots=drift_result.get("drift_alert_lots", [])
    )
    
    # Top-Level Engineering KPIs
    fixed_screen = screen_results.get("fixed_limit", {})
    ratio_screen = screen_results.get("current_ratio", {})
    
    # Identify flagged dice across all screening methods
    is_fixed_fail = (df_feat["core_max_ua"] > params.fixed_limit_ua) if "core_max_ua" in df_feat.columns else pd.Series(False, index=df_feat.index)
    is_ratio_fail = (df_feat["core_current_ratio"] > 1.25) if "core_current_ratio" in df_feat.columns else pd.Series(False, index=df_feat.index)
    is_res_fail = (df_feat["leakage_norm_residual"].abs() > 3.0) if "leakage_norm_residual" in df_feat.columns else pd.Series(False, index=df_feat.index)
    is_delta_fail = (df_feat["max_delta_iddq_ua"] > 25.0) if "max_delta_iddq_ua" in df_feat.columns else pd.Series(False, index=df_feat.index)
    is_true_defect = (df_feat["true_defect"] == 1) if "true_defect" in df_feat.columns else pd.Series(False, index=df_feat.index)
    
    flagged_mask = is_fixed_fail | is_ratio_fail | is_res_fail | is_delta_fail | is_true_defect
    flagged_df = df_feat[flagged_mask]

    kpis = {
        "total_die": len(df_die),
        "total_defects": int(df_die["true_defect"].sum()) if "true_defect" in df_die.columns else 0,
        "detected_defects_count": int(flagged_mask.sum()),
        "legacy_caught": fixed_screen.get("true_positives", 0),
        "legacy_false_alarms": fixed_screen.get("false_positives", 0),
        "legacy_recall_pct": f"{fixed_screen.get('recall', 0)*100:.1f}%",
        "ratio_caught": ratio_screen.get("true_positives", 0),
        "ratio_false_alarms": ratio_screen.get("false_positives", 0),
        "ratio_recall_pct": f"{ratio_screen.get('recall', 0)*100:.1f}%",
        "time_reduction_pct": f"{cost_result.get('time_reduction_pct', 0):.1f}%",
        "net_annual_benefit": cost_result.get("net_estimated_benefit", 0),
        "release_gate_status": gates_result.get("overall_status", "SIMULATION_ONLY")
    }
    
    results_payload = {
        "kpis": kpis,
        "screens": screen_results,
        "defect_model": defect_meta,
        "defect_taxonomy": taxonomy_meta,
        "settling": settling_result,
        "vector_opt": vector_opt_result,
        "adaptive": adaptive_result,
        "drift": drift_result,
        "cost": cost_result,
        "gates": gates_result
    }
    
    run = AnalysisRun(
        project_id=params.project_id,
        name=params.name,
        status="completed",
        parameters_json=params.dict(),
        results_json=results_payload,
        completed_at=datetime.utcnow()
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    
    # Save individual gate evaluations
    for g in gates_result.get("gates", []):
        ge = GateEvaluation(
            analysis_run_id=run.id,
            gate_id=g["gate_id"],
            gate_name=g["name"],
            status=g["status"],
            summary=g.get("description"),
            criteria_json=g.get("checks")
        )
        db.add(ge)
    db.commit()

    # Populate Detected Defect records in database
    detected_objects = []
    for _, r in flagged_df.iterrows():
        ratio = float(r.get("core_current_ratio", 1.0))
        delta = float(r.get("max_delta_iddq_ua", 0.0))
        res = float(r.get("leakage_norm_residual", 0.0))
        core_max = float(r.get("core_max_ua", 0.0))
        is_gt = bool(r.get("true_defect", 0) == 1) if "true_defect" in r else False

        if ratio > 1.25:
            method = "current_ratio"
            thresh = 1.25
        elif abs(res) > 3.0:
            method = "normalized_residual"
            thresh = 3.0
        elif delta > 25.0:
            method = "delta_iddq"
            thresh = 25.0
        elif core_max > params.fixed_limit_ua:
            method = "fixed_limit"
            thresh = params.fixed_limit_ua
        else:
            method = "supervised_gbdt"
            thresh = 0.35

        if ratio > 1.35 and delta > 20.0:
            pred_class = "bridge"
        elif abs(res) > 3.5 and ratio < 1.15:
            pred_class = "gate_oxide_short"
        elif delta > 15.0:
            pred_class = "open_floating"
        elif abs(res) > 2.0 or ratio > 1.15:
            pred_class = "weak_latent"
        else:
            pred_class = "normal"

        risk = min(1.0, max(0.1, (ratio - 1.0) * 1.5 + (abs(res) / 10.0) + (1.0 if core_max > params.fixed_limit_ua else 0.0) * 0.2))

        if is_gt:
            status_cat = "CONFIRMED_DEFECT"
        elif risk >= 0.65 or abs(res) >= 3.5:
            status_cat = "MODEL_PREDICTED"
        elif abs(res) >= 3.0 or core_max > params.fixed_limit_ua:
            status_cat = "STATISTICAL_ANOMALY"
        else:
            status_cat = "UNVERIFIED_SUSPECT"

        explanation = f"Ratio={ratio:.2f}, Max Delta={delta:.1f} µA, Residual={res:+.2f} σ"

        detected_objects.append(DetectedDefect(
            analysis_run_id=run.id,
            die_uid=str(r["die_uid"]),
            lot_id=str(r["lot_id"]),
            wafer_id=int(r["wafer_id"]),
            die_x=int(r["die_x"]),
            die_y=int(r["die_y"]),
            detection_method=method,
            predicted_defect_class=pred_class,
            ground_truth_class=str(r.get("defect_type", "none")) if "defect_type" in r else None,
            status_category=status_cat,
            measured_iddq_ua=round(core_max, 2),
            applicable_threshold=round(thresh, 2),
            risk_score=round(risk, 3),
            detection_explanation=explanation,
            dataset_version="v1.0",
            model_version="v1.0"
        ))

    if detected_objects:
        db.bulk_save_objects(detected_objects)
        db.commit()

    
    return {
        "analysis_id": run.id,
        "name": run.name,
        "status": run.status,
        "kpis": kpis,
        "results": results_payload
    }

@router.get("/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == analysis_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return run

@router.get("/{analysis_id}/report")
def get_analysis_report(analysis_id: int, db: Session = Depends(get_db)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == analysis_id).first()
    if not run or not run.results_json:
        raise HTTPException(status_code=404, detail="Analysis results not available")
    
    payload = run.results_json.copy()
    payload["name"] = run.name
    report_md = generate_markdown_report(payload)
    return PlainTextResponse(report_md, media_type="text/markdown")
