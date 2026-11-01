# IDDQ AI Optimization Platform: REST API Reference

**Base URL:** `http://127.0.0.1:8000/api`  
**Protocol:** HTTP/1.1 REST + JSON  
**Interactive Docs:** `http://127.0.0.1:8000/docs`  

---

## 1. System Health
- **`GET /api/health`**
  - **Description:** Returns system status, database connection, project count, and loaded dataset count.
  - **Response:**
    ```json
    {
      "status": "healthy",
      "platform": "IDDQ AI Optimization Platform",
      "version": "1.0.0",
      "database_connected": true,
      "projects_count": 1,
      "valid_datasets_count": 4
    }
    ```

---

## 2. Projects & Datasets
- **`GET /api/projects`**: Lists all projects.
- **`POST /api/projects`**: Creates a new engineering project.
- **`GET /api/datasets?project_id=1`**: Lists all ingested datasets for a project.
- **`POST /api/datasets/upload`**: Multipart file upload with automated format detection, SHA-256 checksumming, schema validation, and immutable storage.
- **`POST /api/datasets/load-sample?project_id=1`**: 1-Click ingestion and validation of all 4 supplied benchmark CSV files.
- **`GET /api/datasets/readiness?project_id=1`**: Returns data foundation readiness score (0–100%) and enabled analysis capabilities.
- **`GET /api/datasets/{id}/preview`**: Returns preview rows and schema types without memory exhaustion.

---

## 3. Optimization Analyses
- **`GET /api/analyses?project_id=1`**: Lists all analysis runs.
- **`POST /api/analyses/run`**: Executes the comprehensive IDDQ optimization pipeline:
  - **Parameters:**
    ```json
    {
      "project_id": 1,
      "name": "Production Benchmark Optimization",
      "fixed_limit_ua": 450.0,
      "ratio_quantile": 0.995,
      "settling_k_samples": 5,
      "vector_target_coverage_pct": 100.0,
      "adaptive_risk_threshold": 0.20,
      "adaptive_audit_fraction": 0.05,
      "annual_volume": 10000000,
      "tester_cost_per_second": 0.05
    }
    ```
- **`GET /api/analyses/{id}`**: Returns full analysis results payload.
- **`GET /api/analyses/{id}/report`**: Returns the complete engineering markdown report (`text/markdown`).

---

## 4. Die Diagnosis & Investigation
- **`GET /api/die/search?query=...&lot_id=...&wafer_id=...&limit=25`**: Search die records.
- **`GET /api/die/{die_uid}`**: Returns deep-dive diagnosis:
  - Vector-by-vector 20-point IDDQ curve compared to nominal wafer median.
  - Normalized residuals, ratio, delta step.
  - Suspected physical defect hypothesis (Bridge, Oxide Short, Open Gate, Latent Anomaly) and confidence.
  - Local 3×3 wafer neighborhood.
  - Offline ground truth label (for validation auditing only).

---

## 5. Wafer Spatial & Lot Drift
- **`GET /api/wafer/lots`**: Returns available lots and wafer index list.
- **`GET /api/wafer/{lot_id}/{wafer_id}`**: Returns 28×28 wafer coordinate grid array (540 die), site statistics, and leakage values.
- **`GET /api/wafer/drift/timeline?reference_lot=LOT01`**: Computes Population Stability Index (PSI) and distribution shifts across LOT01 to LOT12.

---

## 6. Model Registry & Rollback
- **`GET /api/models`**: Lists all registered model versions, feature schemas, and metrics.
- **`POST /api/models/rollback`**: Instantly rolls back active model to a prior approved version.
