# Requirements Traceability Matrix (RTM)

**Project:** IDDQ AI Optimization Platform  
**Specification Sources:** Master Prompt, `AI-Optimized-IDDQ-Test-Time-Reduction.pdf`, `README_2.md`  

---

## Traceability Matrix

| Req ID | Specification Requirement | Source Reference | Module | Implementation Target | Verification Method |
|---|---|---|---|---|---|
| **REQ-A.1** | Browser upload for 4 CSV types (die data, transients, vector info, fault matrix) | Prompt §5 Mod A | Ingestion | `backend/iddq/ingestion/`, `/api/projects/{id}/datasets` | File upload test with checksum and schema validator |
| **REQ-A.2** | Schema, range, duplicate ID, and null checks | Prompt §5 Mod A | Ingestion | `backend/iddq/validation/schema.py` | Unit tests with corrupted and invalid mock CSVs |
| **REQ-A.3** | Dataset readiness checklist & scoring | Prompt §5 Mod A | Ingestion | `/api/datasets/{id}/readiness` | API returns boolean capability flags (has_transients, etc.) |
| **REQ-B.1** | Join validation across die UID, vector ID, and fault sites | Prompt §5 Mod B, README_2 | Data Quality | `backend/iddq/validation/joins.py` | Verify 100% transient die exist in die table; fault IDs in 0..1999 |
| **REQ-B.2** | Lot split validation (LOT01-08 train, LOT09-10 val, LOT11-12 test) | Prompt §5 Mod B, PDF §6.4 | Data Quality | `backend/iddq/validation/splits.py` | Ensure no random splits; verify lot partitioning |
| **REQ-C.1** | Executive engineering dashboard with interactive KPI cards | Prompt §5 Mod C | UI / API | `frontend/app/dashboard/`, `/api/analyses/{id}/kpis` | Real KPI calculation from loaded dataset; click-through filtering |
| **REQ-D.1** | Derived IDDQ features: min, max, median, CV, max/min ratio | Prompt §5 Mod D, PDF §2.4 | Features | `backend/iddq/features/derived.py` | Formula check against test fixtures with known vectors |
| **REQ-D.2** | Consecutive delta-IDDQ & sorted curve steps | Prompt §5 Mod D, PDF §2.4 | Features | `backend/iddq/features/steps.py` | Step detection for bridge & open activations |
| **REQ-D.3** | Spatial features: wafer radius, edge-die flag, NNR (nearest-neighbor residual) | Prompt §5 Mod D, PDF §4.4 | Features | `backend/iddq/spatial/residuals.py` | KD-Tree 8-neighbor spatial estimation on wafer grid |
| **REQ-D.4** | Process-normalized residuals (regression against RO/leakage monitor) | Prompt §5 Mod D, PDF §4.4 | Features | `backend/iddq/features/normalized.py` | Robust linear/Huber fit on train lots only, applied to val/test |
| **REQ-E.1** | Legacy 450 µA fixed-limit screen evaluation | Prompt §5 Mod E, README_2 §4 | Screens | `backend/iddq/baselines/screens.py` | Reproduce baseline: 67 caught, 854 fails on seed 42 |
| **REQ-E.2** | Max/Min ratio screen with configurable quantile threshold | Prompt §5 Mod E, README_2 §4 | Screens | `backend/iddq/baselines/screens.py` | Quantile threshold on clean die; evaluate recall/overkill |
| **REQ-E.3** | Delta-IDDQ and Mahalanobis multivariate screen | Prompt §5 Mod E, PDF §4.4 | Screens | `backend/iddq/baselines/mahalanobis.py` | Robust covariance (MinCovDet) on clean train die |
| **REQ-E.4** | Isolation Forest unsupervised screen | Prompt §5 Mod E, PDF §4.4 | Screens | `backend/iddq/baselines/isolation_forest.py` | Unsupervised contamination tuning on normal baseline |
| **REQ-E.5** | Screen comparison metrics: Recall, Precision, Overkill, F1, Escapes, LOT12 breakdown | Prompt §5 Mod E | Screens | `backend/iddq/evaluation/metrics.py` | Confusion matrices for each screen, especially LOT12 overkill |
| **REQ-F.1** | Supervised binary defect risk model (Gradient Boosting / Random Forest) | Prompt §5 Mod F, PDF §6.3 | Defect AI | `backend/iddq/defect_detection/classifier.py` | Train on LOT01-08, evaluate on LOT09-10 & LOT11-12 |
| **REQ-F.2** | Multiclass defect classifier (bridge, oxide, open, latent, none) | Prompt §5 Mod F, README_2 | Defect AI | `backend/iddq/defect_detection/multiclass.py` | Predict defect signature class with class-weight compensation |
| **REQ-F.3** | Anti-leakage enforcement (no true_defect, defect_type, downstream outcomes in inputs) | Prompt §5 Mod F, PDF §6.1 | Defect AI | `backend/iddq/features/leakage_guard.py` | Unit test verifying strict column whitelist for feature matrices |
| **REQ-G.1** | Interactive Die Diagnosis page with vector curves, spatial context, evidence breakdown | Prompt §5 Mod G | UI / API | `frontend/app/die-analysis/`, `/api/die/{uid}` | Search by UID or (Lot, Wafer, X, Y); show vector signature & radar |
| **REQ-H.1** | Interactive 28×28 Wafer Maps (Current, Residual, Anomaly, Risk, Ground Truth) | Prompt §5 Mod H, PDF §4.5 | UI / API | `frontend/app/wafer-analysis/`, `/api/wafer/` | Canvas/SVG wafer renderer with zoom, die click, spatial clusters |
| **REQ-H.2** | Lot drift & PSI (Population Stability Index) calculation across LOT01–LOT12 | Prompt §5 Mod H, PDF §6.5 | Spatial / Drift | `backend/iddq/spatial/drift.py` | PSI on 10 quantile bins; alert flag on LOT12 shift |
| **REQ-I.1** | Settling prediction from early transient samples ($t \le 0.5\text{ ms}$) | Prompt §5 Mod I, PDF §4.2 | Settling | `backend/iddq/settling/models.py` | Physics fit + Quantile Regression Gradient Boosting |
| **REQ-I.2** | Conformal/Quantile prediction intervals and guard-band policy | Prompt §5 Mod I, PDF §7.2 | Settling | `backend/iddq/settling/conformal.py` | High uncertainty triggers full settle fallback |
| **REQ-J.1** | Greedy set-cover vector selection on fault matrix | Prompt §5 Mod J, PDF §4.1 | Vector Opt | `backend/iddq/vector_selection/set_cover.py` | Maximize incremental coverage per unit test time |
| **REQ-J.2** | Evaluation of reduced vector sets on held-out test lots (LOT11–12) | Prompt §5 Mod J, PDF §6.4 | Vector Opt | `backend/iddq/vector_selection/evaluator.py` | Count physical bridge/open defective die missed if vectors removed |
| **REQ-K.1** | Pre-IDDQ adaptive testing flow simulation (strictly pre-IDDQ features) | Prompt §5 Mod K, PDF §4.3 | Adaptive | `backend/iddq/adaptive_testing/engine.py` | Uses ring_osc, fmax, vmin, leakmon, wafer coords only |
| **REQ-K.2** | Random full-test audit fraction and unfamiliar data fallback | Prompt §5 Mod K, PDF §7.2 | Adaptive | `backend/iddq/adaptive_testing/audit.py` | Configurable audit % (e.g. 5%), escapes simulation |
| **REQ-L.1** | Vector flow reordering for early fail detection | Prompt §5 Mod L, PDF §4.6 | Flow Order | `backend/iddq/flow_ordering/optimizer.py` | Sort vectors by fallout rate / execution time ratio |
| **REQ-M.1** | Test time formula and financial cost-benefit engine | Prompt §5 Mod M, PDF §3 | Cost Engine | `backend/iddq/cost_model/calculator.py` | $T_{IDDQ}$ savings, annual volume, tester cost/sec, escape penalties |
| **REQ-N.1** | Three Release Gates verification (Gate 1, 2, 3) | Prompt §5 Mod N, PDF §8.1 | Quality Gates | `backend/iddq/evaluation/gates.py` | Automated checklist: Data complete, No coverage loss, Zero shadow escapes |
| **REQ-N.2** | Model versioning, approval state, and rollback capability | Prompt §5 Mod N, PDF §7.4 | Governance | `backend/iddq/governance/registry.py` | Versioned models, active flag, rollback API |
| **REQ-O.1** | Report generation (PDF/HTML/CSV) and audit logging | Prompt §5 Mod O, P | Reporting | `backend/iddq/reporting/exporter.py` | Downloadable comprehensive engineering reports |
| **REQ-P.1** | Persistent analysis runs, parameter configurations, and reproducibility | Prompt §5 Mod P | Database | `backend/app/database/`, `app/models/` | SQLite database preserving runs across service restarts |
