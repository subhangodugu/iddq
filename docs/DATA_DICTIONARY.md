# Data Dictionary & Schema Specification

**Project:** IDDQ AI Optimization Platform  
**Dataset Version:** Synthetic Seed 42 Benchmark  
**Date:** 2026-10-31  

---

## 1. File: `iddq_die_data.csv`
- **Total Records:** 32,400 rows
- **Grain:** One row per individual die
- **Scope:** 12 Lots (`LOT01` to `LOT12`) × 5 Wafers per Lot (Wafers 1 to 5) × 540 Die per Wafer (circular layout on 28×28 grid)

| Column Name | Data Type | Physical Unit | Permitted Range | Description | Feature Category |
|---|---|---|---|---|---|
| `die_uid` | String (PK) | — | Regex: `^L\d{2}W\d{2}X\d{2}Y\d{2}$` | Unique Die Identifier (ECID proxy) | Identifier |
| `lot_id` | String | — | `LOT01`–`LOT12` | Production Lot Identifier | Metadata |
| `wafer_id` | Integer | — | 1–5 | Wafer index within lot | Metadata |
| `die_x` | Integer | grid coord | 0–27 | Physical horizontal die coordinate on wafer | Spatial |
| `die_y` | Integer | grid coord | 0–27 | Physical vertical die coordinate on wafer | Spatial |
| `radius_norm` | Float | normalized | 0.0000–1.0000 | Normalized radial distance from center $(r/r_{max})$ | Spatial |
| `edge_die` | Integer | boolean | 0, 1 | 1 if `radius_norm` > 0.88 (edge exclusion zone) | Spatial |
| `reticle_pos` | Integer | index | 0–5 | Reticle stepping site position `(die_x % 3) + 3*(die_y % 2)` | Spatial |
| `tester_id` | String | — | `T1`, `T2` | Production ATE System identifier | Equipment |
| `site_id` | Integer | index | 1–4 | Parallel test site index on ATE probe card | Equipment |
| `test_temp_c` | Float | °C | 22.0–28.0 | Measured ambient chuck temperature during test | Environmental |
| `ring_osc_mhz` | Float | MHz | 450.0–620.0 | Ring Oscillator frequency (silicon process speed proxy) | Pre-IDDQ Parametric |
| `fmax_mhz` | Float | MHz | 1050.0–1450.0 | Maximum operating clock frequency | Pre-IDDQ Parametric |
| `vmin_v` | Float | Volts (V) | 0.5500–0.6600 | Minimum operating supply voltage | Pre-IDDQ Parametric |
| `leak_monitor_ua` | Float | µA | 0.800–15.000 | On-die quiescent leakage monitor sensor | Pre-IDDQ Parametric |
| `iddq_core_v01_ua` … `v20_ua` | Float | µA | 50.0–2000.0+ | Quiescent supply current on core rail for vectors 1 to 20 | In-IDDQ Measurement |
| `iddq_io_v01_ua` … `v04_ua` | Float | µA | 5.0–150.0+ | Quiescent supply current on I/O rail for vectors 1 to 4 | In-IDDQ Measurement |
| `true_defect` | Integer | boolean | 0, 1 | Ground truth defect oracle label (1 = defective die) | Evaluation Only |
| `defect_type` | String | — | `none`, `bridge`, `gate_oxide_short`, `open_floating`, `latent_weak` | Ground truth physical defect taxonomy | Evaluation Only |
| `defect_fault_id` | Integer | index | -1 to 1999 | Fault ID in `vector_fault_matrix.csv` activated by defect | Evaluation Only |
| `defect_current_ua` | Float | µA | 0.00–500.0+ | Nominal defect current added by physical anomaly | Evaluation Only |
| `fixed_limit_fail` | Integer | boolean | 0, 1 | Legacy fixed screen outcome: $\max(\text{core}) > 450\,\mu\text{A}$ | Baseline Screen |
| `final_test_fail` | Integer | boolean | 0, 1 | Downstream package test outcome | Downstream Label |
| `burn_in_fail` | Integer | boolean | 0, 1 | Downstream burn-in reliability stress test outcome | Downstream Label |
| `field_return` | Integer | boolean | 0, 1 | Downstream customer field failure return outcome | Downstream Label |
| `suggested_split` | String | — | `train`, `validation`, `test` | Time-ordered lot assignment (`train`: LOT01–08, `validation`: LOT09–10, `test`: LOT11–12) | Split Label |
| `process_shift_lot` | Integer | boolean | 0, 1 | 1 for `LOT12` (drift benchmarking lot) | Split Label |

---

## 2. File: `iddq_transients.csv`
- **Total Records:** 30,000 rows
- **Grain:** One row per Die × Core Vector (1,500 die × 20 vectors)
- **Oversampling:** 20% defective die representation to ensure robust tail modeling

| Column Name | Data Type | Physical Unit | Description | Role |
|---|---|---|---|---|
| `die_uid` | String (FK) | — | References `iddq_die_data.die_uid` | Key |
| `vector_id` | Integer (FK) | — | Core vector index 1–20 | Key |
| `rail` | String | — | Power rail (`core`) | Key |
| `true_defect` | Integer | boolean | Ground truth defect status (from die table) | Metadata |
| `suggested_split` | String | — | Data split (`train`, `validation`, `test`) | Metadata |
| `i_t0.1ms_ua` … `i_t2.0ms_ua` | Float (20 cols) | µA | Supply current sampled at $t = 0.1, 0.2, \dots, 2.0\text{ ms}$ post-vector apply | Predictor Features |
| `settled_iddq_ua` | Float | µA | Target fully-settled quiescent current (equals `iddq_core_vXX_ua`) | Target Label (Strictly Target) |
| `full_settle_time_ms` | Float | ms | Programmed settling wait time in legacy ATE test program | Benchmark Baseline |

---

## 3. File: `vector_info.csv`
- **Total Records:** 20 rows
- **Grain:** One row per Core IDDQ Test Vector (Vectors 1 to 20)

| Column Name | Data Type | Physical Unit | Description |
|---|---|---|---|
| `vector_id` | Integer (PK) | — | Vector identifier 1–20 |
| `rail` | String | — | Power rail (`core`) |
| `faults_detected` | Integer | count | Number of modeled fault sites activated in fault matrix |
| `unique_faults_detected` | Integer | count | Number of fault sites detected exclusively by this vector |
| `fault_coverage_pct` | Float | % | Percentage coverage: `100 * faults_detected / 2000` |
| `state_leakage_factor` | Float | multiplier | Multiplicative scaling factor for vector logic state leakage |
| `tau_fast_ms` | Float | ms | Fast settling time constant (decoupling / tester PMU charge transfer) |
| `tau_slow_ms` | Float | ms | Slow settling time constant (power gating / thermal stabilization) |
| `full_settle_time_ms` | Float | ms | Legacy ATE programmed wait duration: $\max(5\tau_1, 3\tau_2) + 0.3\text{ ms}$ |
| `apply_time_ms` | Float | ms | Scan shift and vector state application duration |
| `measure_time_ms` | Float | ms | Analog integration measurement duration (nominal 0.2 ms) |

---

## 4. File: `vector_fault_matrix.csv`
- **Total Records:** 2,000 rows
- **Grain:** One row per modeled physical fault site (`fault_id` 0 to 1,999)
- **Columns:** `fault_id` (PK, int 0–1999) + 20 binary indicator columns `v01`, `v02`, ..., `v20`
- **Value Semantics:** `1` if vector $v$ excites and propagates the fault site, `0` otherwise.
- **Coverage Characteristics:** 12% of fault sites are detected by only a single vector ($k=1$), making their retention essential for 100% modeled fault coverage.
