# Semiconductor Model Card: IDDQ AI Optimization Suite

**Date:** 2026-10-31  
**Version:** 1.0.0  
**Model Types:** Supervised Defect Classifier, Defect Taxonomy Predictor, Transient Settling Regressors, Pre-IDDQ Adaptive Risk Scorer  

---

## 1. Model Summary & Intended Use

The IDDQ AI Optimization Suite consists of four specialized, explainable machine learning models developed for automated test-time reduction and precision outlier screening in high-volume semiconductor manufacturing:

1. **Binary Defect Risk Classifier:**
   - **Algorithm:** Histogram-based Gradient Boosted Trees (`HistGradientBoostingClassifier`).
   - **Input:** 47 post-IDDQ electrical features (raw current, ratio, delta steps, normalized process residuals, NNR).
   - **Target:** Probability of physical silicon anomaly ($p \in [0.0, 1.0]$).
   - **Intended Use:** High-precision outlier screening and anomaly ranking.

2. **Multiclass Defect Taxonomy Classifier:**
   - **Algorithm:** Balanced Multiclass Gradient Boosting.
   - **Taxonomy Classes:** `none`, `bridge`, `gate_oxide_short`, `open_floating`, `latent_weak`.
   - **Intended Use:** Hypothesizing physical defect mechanisms from vector signature profiles to assist failure analysis (FA) engineers. Not intended as destructive physical confirmation.

3. **Transient Settling Regressor:**
   - **Algorithm:** Dual-Exponential physics regression + Quantile Gradient Boosting ($q = 0.05, 0.50, 0.95$).
   - **Input:** First $k$ early transient samples ($t \le 0.5\text{ ms}$, slopes, vector time constants).
   - **Target:** Steady-state quiescent current ($I_{settled}$). Strictly excluded from input features.
   - **Intended Use:** Guarded early termination of tester PMU wait times when uncertainty interval $\le 5.0\,\mu\text{A}$.

4. **Pre-IDDQ Adaptive Risk Scorer:**
   - **Algorithm:** Gradient Boosted Classifier with strict pre-IDDQ parametric feature whitelisting.
   - **Inputs Permitted:** `ring_osc_mhz`, `fmax_mhz`, `vmin_v`, `leak_monitor_ua`, wafer coordinates (`die_x`, `die_y`, `radius_norm`, `edge_die`, `reticle_pos`), tester/site.
   - **Intended Use:** Gating die to full vs. reduced IDDQ test flows before vector execution begins.

---

## 2. Training, Validation & Data Segregation Protocol

To ensure realistic production deployment without overestimating accuracy:
- **Partitioning:** Strictly partitioned by manufacturing lot order:
  - **Training Lots:** `LOT01` to `LOT08` (21,600 die).
  - **Validation Lots:** `LOT09` to `LOT10` (5,400 die) for threshold calibration.
  - **Held-Out Test Lots:** `LOT11` to `LOT12` (5,400 die, including `LOT12` process shift excursion).
- **Anti-Leakage Enforcement:**
  - Feature extraction strictly blacklists `true_defect`, `defect_type`, `defect_fault_id`, `defect_current_ua`, `fixed_limit_fail`, `final_test_fail`, `burn_in_fail`, and `field_return`.
  - Normalization parameters (Huber coefficients, residual MAD scales) are fit strictly on training splits and transformed forward onto validation and test splits.

---

## 3. Quantitative Performance Summary

| Model Component | Primary Metric | Measured Value | Baseline Reference |
|---|---|---|---|
| **Max/Min Current Ratio Screen** | Recall (Defects Caught) | **57.2%** (415 / 725) | Legacy fixed limit: 9.2% (67 / 725) |
| **Max/Min Current Ratio Screen** | False Alarms Overkill | **163 die** | Legacy fixed limit: 854 die |
| **LOT12 Overkill Under Shift** | False Alarms in LOT12 | **16 die** | Legacy fixed limit: 679 die |
| **Settling Prediction (k=5)** | Mean Absolute Error (MAE) | **0.80 µA** | Latest sample baseline: 3.20 µA |
| **Settling Uncertainty** | 90% Prediction Interval Coverage | **90.2%** | Average width: 3.4 µA |
| **Early Termination** | Safe Termination Fraction | **85.4%** of transients | Saved: 2.1 ms per vector |
| **Greedy Set Cover** | Modeled Fault Coverage | **100.0%** (2,000 / 2,000 sites) | All 20 core vectors retained |
| **Pre-IDDQ Adaptive Test** | Test Time Reduction | **47.1%** average per die | Audit fraction: 5.0% full test |

---

## 4. Operational Guard-Bands & Safety Policies

1. **Missing Data Fallback:** Any die missing parametric readings or showing corrupted telemetry is automatically mandated to the Full ATE Test Flow.
2. **Settling Uncertainty Fallback:** If the 90% prediction interval exceeds the $5.0\,\mu\text{A}$ repeatability limit, the tester waits for full programmed settling ($3.5\text{ ms}$).
3. **Drift Alert Policy:** Any lot exhibiting Population Stability Index (PSI) $\ge 0.25$ automatically reverts 100% of units to the Full Flow until product engineering reviews the excursion.
4. **Random Audit Fraction:** Configurable random full-test audit (nominal 5%) continuously checks for unexpected test escapes.
