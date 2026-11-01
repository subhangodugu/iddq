# Repository Audit & Baseline Assessment

**Date:** 2026-10-31  
**Auditor:** Principal Semiconductor Test Engineer & Full-Stack Architect  
**Workspace:** `c:\Users\subha\Downloads\manoj`  
**Project:** IDDQ AI Optimization Platform  

---

## 1. Executive Summary

An audit of the designated workspace (`c:\Users\subha\Downloads\manoj`) was conducted. The initial repository workspace was completely empty. Authoritative project reference materials and benchmark synthetic datasets were located in `C:\Users\subha\Downloads\Test Engineering Solutions (1)\Test Engineering Solutions\AI OPtimized IDDQ` and copied cleanly into the project structure under `dataset_source/` and `data/sample/`.

The environment was probed:
- **Operating System:** Windows 11 (64-bit AMD64)
- **Node.js Runtime:** v24.18.0
- **Package Manager:** npm v11.16.0 (accessed via `npm.cmd` and `npx.cmd` under Windows PowerShell execution policy)
- **Python Runtime:** Python 3.12.10 (AMD64)
- **Scientific & ML Libraries Available:** `numpy`, `pandas`, `scipy`, `scikit-learn`, `xgboost`, `lightgbm`, `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `pytest`, `httpx`, `pymupdf (fitz)`, `pypdf`.

Because no legacy application existed in the workspace, we establish the recommended greenfield architecture from Section 6 of the Master Specification:
- **Backend:** FastAPI + Pydantic v2 + SQLite/SQLAlchemy for metadata and run persistence + NumPy/Pandas/Scikit-learn/XGBoost for analytical and ML engines.
- **Frontend:** Next.js / React 19 / TypeScript / Tailwind CSS / Lucide icons / Chart.js & Recharts for interactive semiconductor engineering dashboards and wafer maps.
- **Data Engine:** Efficient analytical data pipeline with chunked processing, spatial neighbor graphs, robust Mahalanobis and Isolation Forest screeners, conformal/quantile transient regression, and greedy set-cover with held-out fault validation.

---

## 2. Inventory of Authoritative Project Inputs

The project references four primary data files and two key technical guides:

1. **`AI-Optimized-IDDQ-Test-Time-Reduction.pdf`** (11 pages, October 2026):
   - Establishes the 6 optimization levers: Vector Reduction (4.1), Settling-Time Prediction (4.2), Adaptive Per-Die IDDQ (4.3), ML-based Outlier Screening (4.4), Spatial & Wafer-Level Prediction (4.5), and Test-Flow Ordering (4.6).
   - Specifies the test time and financial cost models: $T_{IDDQ} = \sum_{r=1}^R \sum_{v=1}^{N_v} (t_{apply} + t_{settle,r,v} + t_{meas,r}) + t_{range} + t_{retest}$.
   - Defines the Three Release Gates (Gate 1: Data Foundation, Gate 2: Screen & Coverage Validation, Gate 3: Shadow-Mode Validation) and guard-banding policies (random audit fraction, fallback to full flow on drift or missing data).

2. **`README_2.md` / `README.md`** (8,100 bytes):
   - Defines dataset schemas, units, lot splits (Train LOT01–08, Validation LOT09–10, Test LOT11–12), synthetic defect properties, downstream failure probabilities, and baseline reference values (seed 42).

3. **`generate_iddq_dataset.py`** (270 lines, 11,958 bytes):
   - Implements the exact generative equations: wafer radial bowls, process speed offsets driving leakage log-normally, 4-site tester bias `[1.00, 1.02, 0.99, 1.04]`, LOT12 process shift (`lot_speed = 0.55`), bridge/oxide/open/latent defect injections, and two-exponential settling transients ($a_1 e^{-t/\tau_1} + a_2 e^{-t/\tau_2}$).

4. **Supplied Benchmark CSV Datasets:**
   - `iddq_die_data.csv`: 32,400 rows × 49 columns. 0 nulls, 32,400 unique die UIDs across 12 lots × 5 wafers × 540 die. 725 defective die (2.24%). Legacy fixed limit (>450 µA) catches 67 defects while failing 854 good die (706 of which are in shifted LOT12).
   - `iddq_transients.csv`: 30,000 rows × 27 columns. Exactly 1,500 die × 20 core vectors. 20 early time steps ($t = 0.1\text{ ms}$ to $2.0\text{ ms}$) plus target `settled_iddq_ua`.
   - `vector_info.csv`: 20 rows × 11 columns. Core vector execution parameters ($t_{apply}$, $t_{settle}$, $t_{meas}$, state leakage factor, $\tau_{fast}$, $\tau_{slow}$).
   - `vector_fault_matrix.csv`: 2,000 rows × 21 columns. 2,000 modeled fault sites mapped to vectors `v01`–`v20`.

---

## 3. Technology Stack & Architectural Decision

| Subsystem | Selected Technology | Rationale |
|---|---|---|
| **Backend API** | FastAPI (Python 3.12) | High-performance async ASGI framework, native Pydantic schema validation, automatic OpenAPI / Swagger documentation. |
| **Data & ML Engine** | NumPy, Pandas, Scikit-learn, XGBoost, SciPy | Native execution of statistical residuals, robust Mahalanobis distance, Isolation Forest, set cover, quantile regression, and spatial KD-Trees. |
| **Persistence** | SQLite + SQLAlchemy ORM | Zero-setup, serverless ACID persistence for projects, dataset versions, model registry, analysis runs, gate evaluations, and audit logs. |
| **File Storage** | Local managed workspace store | Immutable raw CSV storage and versioned Parquet/JSON artifacts for fast sub-second querying without memory exhaustion. |
| **Frontend Framework** | Next.js 15 / React 19 / TypeScript | Modern SSR/SPA architecture with robust TypeScript types matching backend Pydantic schemas. |
| **Styling & Theme** | Tailwind CSS + Custom Semiconductor Palette | High-contrast dark/light engineering UI, crisp typography (Inter/JetBrains Mono), responsive data density. |
| **Data Visualization** | Chart.js, Recharts, SVG Wafer Canvas | Dynamic interactive wafer maps (pan/zoom, die hover, spatial filters), vector coverage curves, settling waveforms, ROC/PR curves. |
| **Testing** | Pytest + Playwright / Jest | Automated regression tests across data validation, feature engineering, ML training, safety gates, and API workflows. |

---

## 4. Gaps and Immediate Implementation Plan

Since the workspace starts clean, we implement the end-to-end platform in 11 sequential phases:
1. **Phase 1: Project & Dataset Management** - Ingestion, schema validation, checksums, data-readiness checklist.
2. **Phase 2: Feature Engineering & Baseline Screens** - Delta-IDDQ, ratio, normalized residuals, Mahalanobis, Isolation Forest.
3. **Phase 3: AI Defect Detection & Classification** - Gradient boosting, class weighting, explainability, die diagnosis.
4. **Phase 4: Wafer Maps, Spatial Analysis & Lot Drift** - Interactive 28×28 wafer grid maps, site bias, PSI drift metrics.
5. **Phase 5: Settling-Time Prediction** - Exponential decay physics fit + quantile gradient boosting + conformal intervals.
6. **Phase 6: Vector Optimization & Set Cover** - Greedy set cover, time-weighted reduction, held-out LOT11–12 verification.
7. **Phase 7: Adaptive Per-Die Testing** - Pre-IDDQ risk classifier, random audit fraction, missing data fallback, flow simulation.
8. **Phase 8: Test-Time & Financial Cost Engine** - Multi-rail timing formula, tester cost/sec, escape penalty modeling.
9. **Phase 9: Quality Gates & Safety Controls** - Automated Gate 1, Gate 2, Gate 3 verification and model rollback.
10. **Phase 10: Reports & Data Export** - Downloadable PDF/HTML/CSV engineering reports and audit trails.
11. **Phase 11: End-to-End Testing & Verification** - Comprehensive pytest suite and integration tests.
