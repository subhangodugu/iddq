from typing import Dict, Any, List, Optional

def calculate_iddq_test_time(
    vector_times_ms: List[Dict[str, float]],
    range_change_overhead_ms: float = 2.0,
    retest_rate: float = 0.015,
    retest_time_ms: float = 20.0
) -> float:
    """
    Computes baseline test time per die in milliseconds:
    T_baseline = sum(t_apply + t_settle + t_meas) + t_range + (retest_rate * retest_time)
    """
    nominal_sum = sum(
        v.get("apply_time_ms", 0.1) + v.get("full_settle_time_ms", 3.0) + v.get("measure_time_ms", 0.2)
        for v in vector_times_ms
    )
    t_retest = retest_rate * retest_time_ms
    return round(nominal_sum + range_change_overhead_ms + t_retest, 2)

def calculate_cost_benefit(
    baseline_time_ms: float = 85.0,
    optimized_time_ms: float = 38.0,
    annual_volume: int = 10_000_000,
    tester_cost_per_second: float = 0.05,
    escape_cost_per_incident: float = 250.0,
    simulated_additional_escapes: int = 0,
    implementation_cost: float = 25_000.0,
    currency: str = "USD"
) -> Dict[str, Any]:
    """
    Transparent economic calculation engine based on the technical specification.
    Net Benefit = (Seconds Saved * Volume * Tester Cost/s) - Escape Costs - Implementation Costs
    """
    time_saved_per_die_ms = max(0.0, baseline_time_ms - optimized_time_ms)
    time_saved_per_die_sec = time_saved_per_die_ms / 1000.0
    time_reduction_pct = round(100.0 * time_saved_per_die_ms / max(0.01, baseline_time_ms), 2)
    
    total_seconds_saved = time_saved_per_die_sec * annual_volume
    total_hours_saved = total_seconds_saved / 3600.0
    
    gross_tester_savings = total_seconds_saved * tester_cost_per_second
    total_escape_penalty = simulated_additional_escapes * escape_cost_per_incident
    net_economic_benefit = gross_tester_savings - total_escape_penalty - implementation_cost
    
    # Sensitivity Scenarios (+/- 20% volume, +/- 30% tester cost)
    scenarios = [
        {
            "scenario": "Conservative (8M volume, $0.04/s)",
            "volume": int(annual_volume * 0.8),
            "tester_cost_per_sec": round(tester_cost_per_second * 0.8, 3),
            "net_benefit": round((time_saved_per_die_sec * annual_volume * 0.8 * tester_cost_per_second * 0.8) - total_escape_penalty - implementation_cost, 2)
        },
        {
            "scenario": "Base Case",
            "volume": annual_volume,
            "tester_cost_per_sec": tester_cost_per_second,
            "net_benefit": round(net_economic_benefit, 2)
        },
        {
            "scenario": "Aggressive (12M volume, $0.06/s)",
            "volume": int(annual_volume * 1.2),
            "tester_cost_per_sec": round(tester_cost_per_second * 1.2, 3),
            "net_benefit": round((time_saved_per_die_sec * annual_volume * 1.2 * tester_cost_per_second * 1.2) - total_escape_penalty - implementation_cost, 2)
        }
    ]
    
    return {
        "currency": currency,
        "baseline_time_ms": baseline_time_ms,
        "optimized_time_ms": optimized_time_ms,
        "time_saved_per_die_ms": round(time_saved_per_die_ms, 2),
        "time_saved_per_die_sec": round(time_saved_per_die_sec, 4),
        "time_reduction_pct": time_reduction_pct,
        "annual_volume": annual_volume,
        "tester_cost_per_second": tester_cost_per_second,
        "total_test_hours_saved_annually": round(total_hours_saved, 1),
        "gross_tester_savings": round(gross_tester_savings, 2),
        "simulated_additional_escapes": simulated_additional_escapes,
        "escape_cost_per_incident": escape_cost_per_incident,
        "total_escape_penalty": round(total_escape_penalty, 2),
        "implementation_cost": round(implementation_cost, 2),
        "net_estimated_benefit": round(net_economic_benefit, 2),
        "sensitivity_scenarios": scenarios,
        "disclaimer": "All financial values are engineering projections. Savings must be verified on production ATE before capital expenditure or contract commitments."
    }
