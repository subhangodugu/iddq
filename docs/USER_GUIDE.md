# IDDQ AI Optimization Platform: User & Operator Guide

**Version:** 1.0.0  
**Target Audience:** Semiconductor Test Engineers, Product Engineers, Yield Managers, Test Floor Operators  

---

## 1. Quick Start & Startup Commands

### Prerequisites
- Python 3.12+ (AMD64)
- Node.js 20+ and npm

### Starting the Backend Server
From the project root:
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Interactive API documentation will be accessible at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health check: `http://127.0.0.1:8000/api/health`

### Starting the Frontend Cockpit
From the `frontend/` directory:
```bash
npm.cmd run start
```
(Or for development with hot reload: `npm.cmd run dev`)  
The dashboard will open at: `http://localhost:3000`

---

## 2. Standard Engineering Workflows

### 1. Ingesting New Lots & Checking Readiness
1. Navigate to **Dataset Management** (`/datasets`).
2. Upload the new lot's datalogs or click **Load 4 Supplied Benchmark CSVs** to load default benchmark files.
3. Review the **Data Readiness Scorecard** to confirm that schema validations, unique die IDs, and column checks pass.

### 2. Evaluating Baseline Defect Screens
1. Open **Baseline Screens** (`/baseline-screens`).
2. Select between the 6 screening algorithms (Legacy Fixed Limit, Max/Min Ratio, Delta-IDDQ, Normalized Residual, Mahalanobis Distance, Isolation Forest).
3. Inspect the **Confusion Matrix**, **Recall**, and **Overkill Rate**.
4. Check the **LOT12 Breakdown** to verify that lot-level process speed shifts do not cause yield overkill.

### 3. Deep-Dive Die Investigation
1. Navigate to **Die Diagnosis** (`/die-analysis`).
2. Enter a Die UID (e.g., `L01W01X03Y03`) or search by wafer coordinates.
3. Inspect the **Vector-by-Vector Current Signature Profile** comparing the die against nominal wafer median values.
4. Review the **Suspected Physical Defect Hypothesis** (Bridge, Oxide Short, Open Gate, Latent Anomaly) and local 3×3 wafer neighborhood.

### 4. Wafer Spatial Topography & Lot Drift
1. Navigate to **Wafer & Lot Drift** (`/wafer-analysis`).
2. Select the Lot (LOT01 to LOT12) and Wafer (1 to 5).
3. Toggle the color metric between **Core Median IDDQ**, **Normalized Residual**, **Legacy Fail**, and **Ground Truth**.
4. Hover over individual die points to inspect exact micro-ampere readings and coordinates.
5. Review the **4-Site Parallel Tester Bias** bar chart and the **Population Stability Index (PSI)** timeline.

### 5. Early Settling Prediction
1. Navigate to **Settling Prediction** (`/settling-prediction`).
2. Select early sample cutoff ($k=3$, $k=5$, or $k=10$).
3. Verify that prediction error (MAE) sits within the $5.0\,\mu\text{A}$ repeatability guard-band.
4. Review the percentage of measurements eligible for safe early termination.

### 6. Vector Selection & Set Cover
1. Navigate to **Vector Optimization** (`/vector-optimization`).
2. Select target modeled coverage (100%, 99%, 95%).
3. Inspect the progression curve showing incremental coverage gained per unit test time.
4. Check the **Held-Out Test Lot Audit** to verify whether any physical defects would escape under reduced vector sets.

### 7. Adaptive Test Flow Simulation
1. Navigate to **Adaptive Testing** (`/adaptive-testing`).
2. Adjust the **Pre-IDDQ Risk Threshold** and **Random Audit Fraction** sliders.
3. Review the simulated flow distribution (Reduced Flow vs. High-Risk Full Test vs. Random Audit) and projected test time savings.

### 8. Release Gate Qualification & Export
1. Navigate to **Release Gates** (`/validation-gates`) to verify Gate 1, 2, and 3 criteria.
2. Navigate to **Reports & Lineage** (`/reports`) to download the complete engineering markdown report or copy it to the clipboard.
