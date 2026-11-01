#!/usr/bin/env python3
"""
Synthetic IDDQ dataset generator for AI-based IDDQ test-time optimization.

Produces four CSV files:
  iddq_die_data.csv        one row per die: context, wafer position, parametrics,
                           IDDQ per vector and rail, ground-truth defect labels,
                           downstream outcomes and a baseline fixed-limit result
  iddq_transients.csv      settling waveforms for a characterization subset
                           (one row per die x vector)
  vector_info.csv          per-vector metadata: settle time, state factor, coverage
  vector_fault_matrix.csv  fault x vector detection matrix (0/1) for set-cover /
                           vector-reduction experiments

All values are synthetic. Physical models are simplified but keep the
correlations that matter for the ML methods: leakage tracks process speed
(ring oscillator, Fmax, Vmin), a radial wafer trend, lot/wafer offsets,
tester-site bias, a process shift in the last lot, and defect current that
appears only in the vectors whose state activates it.

Usage:  python3 generate_iddq_dataset.py [--seed 42] [--out .]
"""
import argparse
import os

import numpy as np
import pandas as pd

# ---------------------------------------------------------------- config
N_LOTS = 12
WAFERS_PER_LOT = 5
GRID = 28                  # die grid across the wafer diameter
N_CORE_VEC = 20
N_IO_VEC = 4
N_FAULTS = 2000            # modeled bridging/open fault sites
DEFECT_RATE = 0.02
SHIFT_LOT = 12             # lot with a process shift (drift test)
N_SITES = 4
SITE_BIAS = [1.00, 1.02, 0.99, 1.04]   # site 4 reads high
TRANSIENT_DIE = 1500       # die with sampled settling waveforms
T_SAMPLES_MS = np.round(np.arange(0.1, 2.01, 0.1), 2)   # 20 samples
FIXED_LIMIT_UA = 450.0     # legacy single fixed IDDQ limit (core max)

DEFECT_MIX = {             # share of defective die by type
    "bridge": 0.55,
    "gate_oxide_short": 0.20,
    "open_floating": 0.15,
    "latent_weak": 0.10,
}
# probability a die of this class fails downstream: (final test, burn-in, field)
DOWNSTREAM_P = {
    "none": (0.001, 0.0005, 0.0001),
    "bridge": (0.40, 0.15, 0.05),
    "gate_oxide_short": (0.30, 0.40, 0.10),
    "open_floating": (0.50, 0.10, 0.03),
    "latent_weak": (0.05, 0.45, 0.15),
}


def build_fault_matrix(rng):
    """Each fault is detected by a subset of vectors; some by only one."""
    k = rng.choice([1, 2, 3, 4, 6, 8, 12], size=N_FAULTS,
                   p=[0.12, 0.18, 0.2, 0.18, 0.15, 0.1, 0.07])
    # vectors differ in how many faults they excite
    vec_weight = rng.dirichlet(np.full(N_CORE_VEC, 1.5))
    m = np.zeros((N_FAULTS, N_CORE_VEC), dtype=np.int8)
    for f in range(N_FAULTS):
        cols = rng.choice(N_CORE_VEC, size=k[f], replace=False, p=vec_weight)
        m[f, cols] = 1
    return m


def wafer_dies():
    c = (GRID - 1) / 2
    xs, ys = np.meshgrid(np.arange(GRID), np.arange(GRID))
    r = np.hypot(xs - c, ys - c)
    keep = r <= c - 0.3
    return xs[keep], ys[keep], r[keep] / c


def main(seed, out):
    rng = np.random.default_rng(seed)
    os.makedirs(out, exist_ok=True)

    fault_m = build_fault_matrix(rng)
    unique_fault = fault_m.sum(1) == 1
    vec_state = rng.normal(1.0, 0.06, N_CORE_VEC)          # state-dependent leakage
    io_state = rng.normal(1.0, 0.05, N_IO_VEC)
    vec_tau1 = rng.uniform(0.12, 0.40, N_CORE_VEC)          # ms, decap/PMU response
    vec_tau2 = rng.uniform(0.8, 1.6, N_CORE_VEC)            # ms, slow tail (power gating)
    vec_settle = np.round(np.maximum(5 * vec_tau1, 3 * vec_tau2) + 0.3, 2)

    xs, ys, rn = wafer_dies()
    rows = []
    die_seq = 0
    for lot in range(1, N_LOTS + 1):
        lot_speed = rng.normal(0, 0.25)
        if lot == SHIFT_LOT:          # clear upward leakage shift
            lot_speed = 0.55 + rng.normal(0, 0.03)
        for w in range(1, WAFERS_PER_LOT + 1):
            wafer_speed = lot_speed + rng.normal(0, 0.12)
            gx, gy = rng.normal(0, 0.08, 2)                 # wafer gradient
            tester = int(rng.integers(1, 3))
            n = len(xs)
            c = (GRID - 1) / 2
            speed = (wafer_speed + 0.30 * rn ** 2 + gx * (xs - c) / c + gy * (ys - c) / c
                     + rng.normal(0, 0.15, n))
            edge = rn > 0.88
            temp = rng.normal(25.0, 0.6, n)
            tfac = np.exp(0.045 * (temp - 25.0))
            site = (xs % 2) + 2 * (ys % 2) + 1              # 4-site parallel test
            sbias = np.array(SITE_BIAS)[site - 1]

            ro = 500 * (1 + 0.06 * speed) + rng.normal(0, 3, n)
            fmax = 1200 * (1 + 0.05 * speed) + rng.normal(0, 12, n)
            vmin = 0.620 - 0.018 * speed + rng.normal(0, 0.006, n)
            leakmon = 2.0 * np.exp(1.1 * speed + rng.normal(0, 0.08, n))

            base_core = 150 * np.exp(1.2 * speed + rng.normal(0, 0.10, n)) * (1 + 0.15 * edge)
            base_io = 20 * np.exp(0.8 * speed + rng.normal(0, 0.10, n))

            core = (base_core[:, None] * vec_state[None, :]
                    * rng.normal(1, 0.01, (n, N_CORE_VEC)))
            io = base_io[:, None] * io_state[None, :] * rng.normal(1, 0.01, (n, N_IO_VEC))

            # defects
            dtype = np.array(["none"] * n, dtype=object)
            fault_id = np.full(n, -1)
            dmag = np.zeros(n)
            is_def = rng.random(n) < DEFECT_RATE * (1 + 0.8 * edge)
            types = list(DEFECT_MIX)
            for i in np.where(is_def)[0]:
                t = rng.choice(types, p=list(DEFECT_MIX.values()))
                dtype[i] = t
                if t == "bridge":
                    f = rng.integers(N_FAULTS)
                    act = fault_m[f].astype(bool)
                    mag = rng.lognormal(np.log(30), 1.0)
                    core[i, act] += mag * rng.normal(1, 0.05, act.sum())
                    fault_id[i] = f
                elif t == "gate_oxide_short":
                    mag = rng.lognormal(np.log(40), 0.9)
                    core[i] += mag * rng.normal(1, 0.15, N_CORE_VEC).clip(0.3)
                    if rng.random() < 0.2:
                        io[i] += mag * 0.5
                elif t == "open_floating":
                    cand = np.where(unique_fault | (fault_m.sum(1) <= 3))[0]
                    f = rng.choice(cand)
                    act = fault_m[f].astype(bool)
                    mag = rng.lognormal(np.log(20), 0.8)
                    core[i, act] += mag * rng.uniform(0.6, 1.4, act.sum())
                    fault_id[i] = f
                else:  # latent / weak
                    mag = rng.uniform(3, 15)
                    act = rng.random(N_CORE_VEC) < 0.3
                    core[i, act] += mag
                dmag[i] = mag

            # environment, site bias, measurement noise
            core = core * tfac[:, None] * sbias[:, None]
            io = io * tfac[:, None] * sbias[:, None]
            core += rng.normal(0, 0.5, core.shape) + core * rng.normal(0, 0.005, core.shape)
            io += rng.normal(0, 0.3, io.shape)
            core, io = core.clip(0.1), io.clip(0.1)

            for i in range(n):
                d = dtype[i]
                p_ft, p_bi, p_fr = DOWNSTREAM_P[d]
                ft = rng.random() < p_ft
                bi = (not ft) and rng.random() < p_bi
                fr = (not ft) and (not bi) and rng.random() < p_fr
                die_seq += 1
                row = {
                    "die_uid": f"L{lot:02d}W{w:02d}X{xs[i]:02d}Y{ys[i]:02d}",
                    "lot_id": f"LOT{lot:02d}",
                    "wafer_id": w,
                    "die_x": int(xs[i]),
                    "die_y": int(ys[i]),
                    "radius_norm": round(rn[i], 4),
                    "edge_die": int(edge[i]),
                    "reticle_pos": int((xs[i] % 3) + 3 * (ys[i] % 2)),
                    "tester_id": f"T{tester}",
                    "site_id": int(site[i]),
                    "test_temp_c": round(temp[i], 2),
                    "ring_osc_mhz": round(ro[i], 2),
                    "fmax_mhz": round(fmax[i], 1),
                    "vmin_v": round(vmin[i], 4),
                    "leak_monitor_ua": round(leakmon[i], 3),
                }
                for v in range(N_CORE_VEC):
                    row[f"iddq_core_v{v + 1:02d}_ua"] = round(core[i, v], 2)
                for v in range(N_IO_VEC):
                    row[f"iddq_io_v{v + 1:02d}_ua"] = round(io[i, v], 2)
                row.update({
                    "true_defect": int(d != "none"),
                    "defect_type": d,
                    "defect_fault_id": int(fault_id[i]),
                    "defect_current_ua": round(dmag[i], 2),
                    "fixed_limit_fail": int(core[i].max() > FIXED_LIMIT_UA),
                    "final_test_fail": int(ft),
                    "burn_in_fail": int(bi),
                    "field_return": int(fr),
                })
                rows.append(row)

    die = pd.DataFrame(rows)
    split = {f"LOT{l:02d}": ("train" if l <= 8 else "validation" if l <= 10 else "test")
             for l in range(1, N_LOTS + 1)}
    die["suggested_split"] = die["lot_id"].map(split)
    die["process_shift_lot"] = (die["lot_id"] == f"LOT{SHIFT_LOT:02d}").astype(int)
    die.to_csv(os.path.join(out, "iddq_die_data.csv"), index=False)

    # transients for a characterization subset (oversample defective die)
    dpos = die.index[die.true_defect == 1].to_numpy()
    dneg = die.index[die.true_defect == 0].to_numpy()
    n_def = min(len(dpos), TRANSIENT_DIE // 5)
    pick = np.concatenate([rng.choice(dpos, n_def, replace=False),
                           rng.choice(dneg, TRANSIENT_DIE - n_def, replace=False)])
    trows = []
    for idx in pick:
        r = die.loc[idx]
        for v in range(N_CORE_VEC):
            final = r[f"iddq_core_v{v + 1:02d}_ua"]
            a1 = final * rng.uniform(2, 8) + rng.uniform(100, 400)
            a2 = final * rng.uniform(0.05, 0.3)
            tau1 = vec_tau1[v] * rng.normal(1, 0.08)
            tau2 = vec_tau2[v] * rng.normal(1, 0.08)
            wave = (final + a1 * np.exp(-T_SAMPLES_MS / tau1) + a2 * np.exp(-T_SAMPLES_MS / tau2)
                    + rng.normal(0, 0.6, len(T_SAMPLES_MS)))
            tr = {"die_uid": r.die_uid, "vector_id": v + 1, "rail": "core",
                  "true_defect": r.true_defect, "suggested_split": r.suggested_split}
            for t, val in zip(T_SAMPLES_MS, wave):
                tr[f"i_t{t:.1f}ms_ua"] = round(val, 2)
            tr["settled_iddq_ua"] = final
            tr["full_settle_time_ms"] = vec_settle[v]
            trows.append(tr)
    pd.DataFrame(trows).to_csv(os.path.join(out, "iddq_transients.csv"), index=False)

    # vector metadata and fault matrix
    det = fault_m.sum(0)
    uniq = fault_m[unique_fault].sum(0)
    pd.DataFrame({
        "vector_id": np.arange(1, N_CORE_VEC + 1),
        "rail": "core",
        "faults_detected": det,
        "unique_faults_detected": uniq,
        "fault_coverage_pct": np.round(100 * det / N_FAULTS, 2),
        "state_leakage_factor": np.round(vec_state, 4),
        "tau_fast_ms": np.round(vec_tau1, 3),
        "tau_slow_ms": np.round(vec_tau2, 3),
        "full_settle_time_ms": vec_settle,
        "apply_time_ms": np.round(rng.uniform(0.05, 0.15, N_CORE_VEC), 3),
        "measure_time_ms": 0.2,
    }).to_csv(os.path.join(out, "vector_info.csv"), index=False)

    fm = pd.DataFrame(fault_m, columns=[f"v{v + 1:02d}" for v in range(N_CORE_VEC)])
    fm.insert(0, "fault_id", np.arange(N_FAULTS))
    fm.to_csv(os.path.join(out, "vector_fault_matrix.csv"), index=False)

    print(f"die rows: {len(die):,}  defective: {die.true_defect.sum():,} "
          f"({100 * die.true_defect.mean():.2f}%)  transient rows: {len(trows):,}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    main(a.seed, a.out)
