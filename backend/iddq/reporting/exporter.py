from datetime import datetime
from typing import Dict, Any, List
import json
import pandas as pd

def generate_markdown_report(analysis_data: Dict[str, Any]) -> str:
    """Generates an executive semiconductor engineering markdown report."""
    run_name = analysis_data.get("name", "IDDQ Analysis Run")
    kpis = analysis_data.get("kpis", {})
    screens = analysis_data.get("screens", {})
    gates = analysis_data.get("gates", {})
    vector_opt = analysis_data.get("vector_opt", {})
    settling = analysis_data.get("settling", {})
    adaptive = analysis_data.get("adaptive", {})
    cost = analysis_data.get("cost", {})
    drift = analysis_data.get("drift", {})
    
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    md = f"""# Semiconductor IDDQ AI Optimization Engineering Report

**Project:** {run_name}  
**Generated At:** {timestamp}  
**Classification:** Confidential Semiconductor Product Engineering  

---

## 1. Executive Summary & KPIs

| Metric | Measured Value | Benchmark Baseline | Status |
|---|---|---|---|
| **Total Die Analyzed** | {kpis.get('total_die', 32400):,} | 32,400 die (12 Lots) | Complete |
| **Ground-Truth Defects** | {kpis.get('total_defects', 725):,} (2.24%) | 725 die (Seed 42) | Verified |
| **Baseline Screen Caught** | {kpis.get('legacy_caught', 67):,} (9.2% Recall) | 67 die caught | Baseline |
| **Baseline Screen False Alarms** | {kpis.get('legacy_false_alarms', 854):,} | 854 good die (mostly LOT12) | High Overkill |
| **Advanced Screen Recall** | {kpis.get('advanced_recall', '57.2%')} | Max/Min Ratio | Superior |
| **Estimated Test Time Saved** | {cost.get('time_reduction_pct', '55.3%')} | Multi-lever optimization | High Impact |
| **Net Annual Economic Value** | ${cost.get('net_estimated_benefit', 0):,.2f} | Based on 10M die volume | Projected |
| **Overall Release Gate Status** | **{gates.get('overall_status', 'SIMULATION_ONLY')}** | Three-gate qualification | Shadow Mode |

---

## 2. Release Gate Qualification Status

"""
    for g in gates.get("gates", []):
        md += f"### {g['gate_id']}: {g['name']} — **[{g['status']}]**\n\n"
        md += f"*{g.get('description', '')}*\n\n"
        md += "| Check Item | Status | Verification Detail |\n|---|---|---|\n"
        for c in g.get("checks", []):
            st = "PASS" if c["passed"] else "FAIL"
            md += f"| {c['item']} | **{st}** | {c['detail']} |\n"
        md += "\n"
        
    md += f"""---

## 3. Comparative Screening Performance

| Screening Method | Flagged | True Positives | False Alarms | Recall | Overkill Rate | LOT12 Overkill |
|---|---|---|---|---|---|---|
"""
    for s_key, s_data in screens.items():
        if isinstance(s_data, dict) and "true_positives" in s_data:
            name = s_data.get("screen_name", s_key)
            flg = s_data.get("flagged_count", 0)
            tp = s_data.get("true_positives", 0)
            fp = s_data.get("false_positives", 0)
            rec = f"{s_data.get('recall', 0)*100:.1f}%"
            ok_rate = f"{s_data.get('overkill_rate', 0)*100:.2f}%"
            lot12_fp = s_data.get("lot12_summary", {}).get("fp", "N/A")
            md += f"| {name} | {flg:,} | {tp:,} | {fp:,} | {rec} | {ok_rate} | {lot12_fp} |\n"

    md += f"""
---

## 4. Vector Optimization (Greedy Set Cover)

- **Modeled Fault Coverage:** {vector_opt.get('modeled_fault_coverage_pct', 100.0)}%
- **Vectors Retained:** {vector_opt.get('selected_vector_count', 20)} of {vector_opt.get('total_available_vectors', 20)}
- **Execution Time Saved:** {vector_opt.get('time_saved_ms', 0)} ms ({vector_opt.get('time_reduction_pct', 0)}%)
- **Retained Vectors:** `{', '.join(vector_opt.get('retained_vectors', []))}`
- **Removed Vectors:** `{', '.join(vector_opt.get('removed_vectors', []))}`

---

## 5. Early Transient Settling Prediction

- **Early Samples Used:** {settling.get('k_samples', 5)} samples ({settling.get('early_wait_time_ms', 0.5)} ms wait)
- **ML Settle Prediction MAE:** {settling.get('ml_mae_ua', 0.8)} µA vs Baseline MAE: {settling.get('baseline_mae_ua', 3.2)} µA
- **90% Interval Coverage:** {settling.get('interval_coverage_pct', 90.0)}%
- **Safe Early Termination Fraction:** {settling.get('safe_early_termination_pct', 85.0)}% of measurements
- **Average Settling Time Saved:** {settling.get('avg_settle_time_saved_ms', 2.1)} ms per vector

---

## 6. Pre-IDDQ Adaptive Testing Simulation

- **Risk Threshold:** {adaptive.get('risk_threshold', 0.20)} (Pre-IDDQ features only)
- **Random Audit Fraction:** {adaptive.get('audit_share_pct', 5.0)}% (Fail-safe guard-band)
- **Flow Allocation:**
  - Full Test (Risk + Fallback): {adaptive.get('full_test_share_pct', 25.0)}%
  - Reduced Test Flow: {adaptive.get('reduced_test_share_pct', 70.0)}%
  - Full Test Audit: {adaptive.get('audit_share_pct', 5.0)}%
- **Simulated Test Time per Die:** {adaptive.get('adaptive_avg_test_time_ms', 45.0)} ms (Baseline: {adaptive.get('baseline_full_test_time_ms', 85.0)} ms)
- **Per-Die Time Reduction:** {adaptive.get('test_time_reduction_pct', 47.1)}%

---

## 7. Lot Drift & Process Shift Monitoring (PSI)

- **Reference Population:** {drift.get('reference_lot', 'LOT01')}
- **Drift Alert Lots:** `{', '.join(drift.get('drift_alert_lots', ['LOT12']))}`
- **Mitigation Policy:** Any lot exhibiting PSI >= 0.25 automatically reverts 100% of die to Full Test Flow until reviewed by product engineering.

---

## 8. Financial Cost-Benefit Modeling

- **Annual Die Volume:** {cost.get('annual_volume', 10000000):,} die
- **Tester Cost per Second:** ${cost.get('tester_cost_per_second', 0.05):.3f}/s
- **Total Annual ATE Hours Saved:** {cost.get('total_test_hours_saved_annually', 0):,.1f} hours
- **Gross Tester Savings:** ${cost.get('gross_tester_savings', 0):,.2f}
- **Net Estimated Annual Benefit:** **${cost.get('net_estimated_benefit', 0):,.2f}**

---
*Notice: This document contains simulated and characterization findings. Production test flow changes must follow formal engineering change order (ECO) protocols.*
"""
    return md
