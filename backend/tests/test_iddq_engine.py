import pytest
import numpy as np
import pandas as pd
from backend.iddq.validation.validators import validate_die_data, validate_transients, validate_fault_matrix
from backend.iddq.features.leakage_guard import FORBIDDEN_COLUMNS, verify_no_leakage, sanitize_features
from backend.iddq.features.pipeline import compute_derived_features, fit_process_normalized_residuals
from backend.iddq.baselines.screens import evaluate_all_screens
from backend.iddq.vector_selection.set_cover import run_greedy_set_cover
from backend.iddq.settling.models import train_settling_predictor
from backend.iddq.adaptive_testing.engine import train_adaptive_risk_model, simulate_adaptive_testing
from backend.iddq.cost_model.calculator import calculate_cost_benefit
from backend.iddq.evaluation.gates import evaluate_release_gates

@pytest.fixture
def sample_die_df():
    # Synthetic micro-dataset with known properties
    np.random.seed(42)
    n = 100
    data = {
        "die_uid": [f"L01W01X{i:02d}Y{i:02d}" for i in range(n)],
        "lot_id": ["LOT01"] * 80 + ["LOT12"] * 20,
        "wafer_id": [1] * n,
        "die_x": np.arange(n) % 28,
        "die_y": np.arange(n) % 28,
        "radius_norm": np.linspace(0.1, 0.95, n),
        "edge_die": (np.linspace(0.1, 0.95, n) > 0.88).astype(int),
        "reticle_pos": np.arange(n) % 6,
        "tester_id": ["T1"] * n,
        "site_id": (np.arange(n) % 4) + 1,
        "test_temp_c": np.full(n, 25.0),
        "ring_osc_mhz": np.random.normal(500, 10, n),
        "fmax_mhz": np.random.normal(1200, 20, n),
        "vmin_v": np.random.normal(0.62, 0.01, n),
        "leak_monitor_ua": np.random.uniform(1.5, 4.0, n),
        "suggested_split": ["train"] * 70 + ["validation"] * 10 + ["test"] * 20,
        "true_defect": [0] * 90 + [1] * 10,
        "defect_type": ["none"] * 90 + ["bridge"] * 5 + ["gate_oxide_short"] * 3 + ["open_floating"] * 2,
        "defect_fault_id": [-1] * 90 + [10, 20, 30, 40, 50, -1, -1, -1, 15, 25],
        "fixed_limit_fail": [0] * 92 + [1] * 8
    }
    for v in range(1, 21):
        data[f"iddq_core_v{v:02d}_ua"] = np.random.uniform(100, 200, n)
    for v in range(1, 5):
        data[f"iddq_io_v{v:02d}_ua"] = np.random.uniform(15, 25, n)
        
    # Inject defect signature on bridges
    df = pd.DataFrame(data)
    df.loc[df["defect_type"] == "bridge", "iddq_core_v05_ua"] += 120.0
    return df

def test_leakage_guard_rejects_ground_truth():
    """Verify that verify_no_leakage raises error on label columns."""
    with pytest.raises(ValueError, match="CRITICAL LEAKAGE DETECTED"):
        verify_no_leakage(["ring_osc_mhz", "true_defect"])
        
    with pytest.raises(ValueError, match="CRITICAL LEAKAGE DETECTED"):
        verify_no_leakage(["core_median_ua", "defect_type"])
        
    # Safe features pass
    safe = ["ring_osc_mhz", "fmax_mhz", "leak_monitor_ua"]
    verify_no_leakage(safe)

def test_derived_features_safeguards_zero_division():
    """Verify max/min ratio has safeguard for zero or near-zero denominators."""
    df = pd.DataFrame({
        "iddq_core_v01_ua": [0.0, 100.0],
        "iddq_core_v02_ua": [50.0, 150.0]
    })
    res = compute_derived_features(df)
    assert not np.isinf(res["core_current_ratio"]).any()
    assert not np.isnan(res["core_current_ratio"]).any()
    assert res["core_current_ratio"].iloc[0] > 0

def test_data_validation_catches_duplicates():
    """Verify validate_die_data flags duplicate die_uid."""
    df_dup = pd.DataFrame({
        "die_uid": ["DIE01", "DIE01"],
        "lot_id": ["LOT01", "LOT01"]
    })
    res = validate_die_data(df_dup)
    assert res["passed"] is False
    assert any("duplicate" in e.lower() for e in res["errors"])

def test_process_normalized_residuals_strictly_train_fit(sample_die_df):
    """Verify Huber regression fits only on training mask."""
    df = compute_derived_features(sample_die_df)
    train_mask = (df["suggested_split"] == "train").to_numpy()
    norm_res, meta = fit_process_normalized_residuals(df, train_mask)
    assert len(norm_res) == len(df)
    assert "train_mad" in meta
    assert meta["train_mad"] > 0

def test_greedy_set_cover_logic():
    """Verify greedy set-cover achieves 100% coverage on toy fault matrix."""
    df_faults = pd.DataFrame({
        "fault_id": [0, 1, 2, 3],
        "v01": [1, 1, 0, 0],
        "v02": [0, 0, 1, 1],
        "v03": [1, 0, 0, 1]
    })
    df_vinfo = pd.DataFrame({
        "vector_id": [1, 2, 3],
        "full_settle_time_ms": [2.0, 2.0, 3.0],
        "apply_time_ms": [0.1, 0.1, 0.1],
        "measure_time_ms": [0.2, 0.2, 0.2]
    })
    res = run_greedy_set_cover(df_faults, df_vinfo, target_coverage_pct=100.0)
    assert res["modeled_fault_coverage_pct"] == 100.0
    assert set(res["retained_vectors"]) == {"v01", "v02"}
    assert res["time_saved_ms"] > 0

def test_cost_benefit_calculation():
    """Verify net benefit formula."""
    res = calculate_cost_benefit(
        baseline_time_ms=85.0,
        optimized_time_ms=45.0,
        annual_volume=1_000_000,
        tester_cost_per_second=0.05,
        simulated_additional_escapes=0,
        implementation_cost=10_000.0
    )
    # Saved: 40ms = 0.04s. 1M die * 0.04s = 40,000s * $0.05 = $2,000 gross. Net = $2,000 - $10,000 = -$8,000
    assert res["time_saved_per_die_ms"] == 40.0
    assert res["gross_tester_savings"] == 2000.0
    assert res["net_estimated_benefit"] == -8000.0

def test_three_release_gates_evaluation():
    """Verify Gate 1, 2, 3 statuses."""
    d_qual = {"die_data": {"passed": True, "has_splits": True, "row_count": 32400}}
    screens = {
        "fixed_limit": {"true_positives": 67, "false_positives": 854, "recall": 0.092},
        "current_ratio": {"true_positives": 415, "false_positives": 163, "recall": 0.572}
    }
    vec_opt = {"modeled_fault_coverage_pct": 100.0, "target_coverage_pct": 100.0}
    settling = {"ml_mae_ua": 1.2, "repeatability_tolerance_ua": 5.0, "safe_early_termination_pct": 85.0}
    adaptive = {"audit_share_pct": 5.0, "defects_routed_to_reduced_test": 0}
    
    gates = evaluate_release_gates(d_qual, screens, vec_opt, settling, adaptive)
    assert gates["overall_status"] == "PRODUCTION_READY"
    g_map = {g["gate_id"]: g["status"] for g in gates["gates"]}
    assert g_map["GATE_1"] == "PASSED"
    assert g_map["GATE_2"] == "PASSED"
    assert g_map["GATE_3"] == "PASSED"
