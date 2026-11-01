from typing import Dict, Any, List

def compute_data_readiness(
    has_die_data: bool,
    has_transients: bool,
    has_vector_info: bool,
    has_fault_matrix: bool,
    die_report: Dict[str, Any] = None,
    transients_report: Dict[str, Any] = None,
    vector_report: Dict[str, Any] = None,
    fault_report: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Computes an engineering readiness score (0-100) and capability checklist.
    Exposes which analyses are enabled and which are blocked by missing inputs.
    """
    checklist = [
        {
            "name": "Die Parametric & Current Measurements",
            "required_for": ["Baseline Screens", "Defect Detection", "Wafer Maps", "Adaptive Testing"],
            "status": "READY" if has_die_data and (die_report and die_report.get("passed")) else "MISSING",
            "weight": 35
        },
        {
            "name": "Settling Transient Waveforms",
            "required_for": ["Settling-Time Prediction", "Guarded Early Termination"],
            "status": "READY" if has_transients and (transients_report and transients_report.get("passed")) else "MISSING",
            "weight": 25
        },
        {
            "name": "Vector Execution Timing Metadata",
            "required_for": ["Test-Time & Cost Calculations", "Vector Set Cover Weighting", "Flow Ordering"],
            "status": "READY" if has_vector_info and (vector_report and vector_report.get("passed")) else "MISSING",
            "weight": 20
        },
        {
            "name": "Modeled Vector Fault Matrix",
            "required_for": ["Vector Reduction (Set Cover)", "Modeled Fault Coverage Validation"],
            "status": "READY" if has_fault_matrix and (fault_report and fault_report.get("passed")) else "MISSING",
            "weight": 20
        }
    ]
    
    score = sum(item["weight"] for item in checklist if item["status"] == "READY")
    
    capabilities = {
        "baseline_screens": has_die_data,
        "defect_classification": has_die_data,
        "wafer_spatial_analysis": has_die_data,
        "adaptive_testing": has_die_data,
        "settling_prediction": has_die_data and has_transients,
        "vector_optimization": has_fault_matrix and has_vector_info,
        "test_time_cost_model": has_die_data and has_vector_info,
        "release_gate_1": score >= 35,
        "release_gate_2": score >= 55,
        "release_gate_3": score == 100,
    }
    
    status_label = "Production Ready" if score == 100 else ("Partially Configured" if score >= 35 else "Unprepared")
    
    return {
        "readiness_score": score,
        "status_label": status_label,
        "checklist": checklist,
        "capabilities": capabilities,
        "missing_components": [c["name"] for c in checklist if c["status"] == "MISSING"]
    }
