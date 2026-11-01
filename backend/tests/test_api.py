import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data

def test_projects_list():
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_dataset_readiness():
    response = client.get("/api/datasets/readiness?project_id=1")
    assert response.status_code == 200
    data = response.json()
    assert "readiness_score" in data
    assert "checklist" in data
    assert "capabilities" in data

def test_load_sample_and_run_analysis():
    # 1. Load benchmark datasets
    r_load = client.post("/api/datasets/load-sample?project_id=1")
    assert r_load.status_code == 200
    
    # 2. Run analysis
    payload = {
        "project_id": 1,
        "name": "Integration Test Optimization Run",
        "fixed_limit_ua": 450.0,
        "ratio_quantile": 0.995,
        "settling_k_samples": 5,
        "vector_target_coverage_pct": 100.0,
        "adaptive_risk_threshold": 0.20,
        "adaptive_audit_fraction": 0.05,
        "annual_volume": 1000000,
        "tester_cost_per_second": 0.05
    }
    r_run = client.post("/api/analyses/run", json=payload)
    assert r_run.status_code == 200
    res = r_run.json()
    assert "analysis_id" in res
    assert "kpis" in res
    assert res["status"] == "completed"
    
    analysis_id = res["analysis_id"]
    
    # 3. Check report endpoint
    r_rep = client.get(f"/api/analyses/{analysis_id}/report")
    assert r_rep.status_code == 200
    assert "Semiconductor IDDQ AI Optimization Engineering Report" in r_rep.text

def test_die_diagnosis_and_wafer_map():
    # Query a sample die
    r_search = client.get("/api/die/search?limit=5")
    assert r_search.status_code == 200
    results = r_search.json()
    if results:
        sample_uid = results[0]["die_uid"]
        r_die = client.get(f"/api/die/{sample_uid}")
        assert r_die.status_code == 200
        die_data = r_die.json()
        assert die_data["die_uid"] == sample_uid
        assert "vector_profile_chart" in die_data
        assert "diagnosis" in die_data
        assert len(die_data["vector_profile_chart"]) == 20

    # Query wafer map
    r_wafer = client.get("/api/wafer/LOT01/1")
    assert r_wafer.status_code == 200
    w_data = r_wafer.json()
    assert w_data["lot_id"] == "LOT01"
    assert "dies" in w_data
    assert len(w_data["dies"]) > 0

    # Query drift
    r_drift = client.get("/api/wafer/drift/timeline")
    assert r_drift.status_code == 200
    d_data = r_drift.json()
    assert "lot_drift_timeline" in d_data

def test_defects_and_comparison_endpoints():
    # 1. Test defects list
    r_def = client.get("/api/defects?limit=10")
    assert r_def.status_code == 200
    def_data = r_def.json()
    assert "total_count" in def_data
    assert "items" in def_data

    # 2. Test defects summary
    r_sum = client.get("/api/defects/summary")
    assert r_sum.status_code == 200
    sum_data = r_sum.json()
    assert "by_status_category" in sum_data

    # 3. Test defects export
    r_exp = client.get("/api/defects/export")
    assert r_exp.status_code == 200
    assert "die_uid,lot_id" in r_exp.text

    # 4. Test die compare
    r_search = client.get("/api/die/search?limit=2")
    assert r_search.status_code == 200
    dies = r_search.json()
    assert len(dies) >= 2
    uid1, uid2 = dies[0]["die_uid"], dies[1]["die_uid"]
    
    r_comp = client.get(f"/api/die/compare?die1_uid={uid1}&die2_uid={uid2}")
    assert r_comp.status_code == 200
    comp_data = r_comp.json()
    assert "die1" in comp_data
    assert "die2" in comp_data
    assert "overlay_vector_chart" in comp_data
    assert len(comp_data["overlay_vector_chart"]) == 20


    # 5. Test dataset history and preview
    r_hist = client.get("/api/datasets/history")
    assert r_hist.status_code == 200
    assert isinstance(r_hist.json(), list)

    r_prev = client.get("/api/datasets/1/preview")
    assert r_prev.status_code == 200
    prev_data = r_prev.json()
    assert "preview_columns" in prev_data
    assert "preview_rows" in prev_data

