#!/usr/bin/env python3
"""
analyze_slo.py
Reads synthetic errors/traffic and produces an SLO + error budget burn view.

Output:
- data/slo.csv  (per-minute availability and rolling burn-rate)
"""

from __future__ import annotations

import os
import pandas as pd


OUT_DIR = "data"
WINDOW_MIN = 60  # rolling window for burn-rate


def main() -> None:
    traffic = pd.read_csv(os.path.join(OUT_DIR, "traffic.csv"), parse_dates=["ts"])
    errors = pd.read_csv(os.path.join(OUT_DIR, "errors.csv"), parse_dates=["ts"])

    # Aggregate across regions to get a service-level view
    t = traffic.groupby(["ts", "service"], as_index=False)["rps"].sum()
    e = errors.groupby(["ts", "service"], as_index=False)["errors_per_min"].sum()

    df = pd.merge(t, e, on=["ts", "service"], how="inner")

    df["requests_per_min"] = df["rps"] * 60.0
    df["error_rate"] = (df["errors_per_min"] / df["requests_per_min"]).fillna(0.0)

    # Availability proxy
    df["availability"] = 1.0 - df["error_rate"]

    # Example SLO: 99.9% availability
    slo = 0.999
    df["error_budget_per_min"] = 1.0 - slo

    # Burn rate over rolling window:
    # burn = observed_error_rate / allowed_error_rate
    allowed = df["error_budget_per_min"].iloc[0]
    df["burn_rate_1h"] = (df["error_rate"].rolling(WINDOW_MIN).mean() / allowed).fillna(0.0)

    out = df[["ts", "service", "rps", "requests_per_min", "errors_per_min", "error_rate", "availability", "burn_rate_1h"]]
    out.to_csv(os.path.join(OUT_DIR, "slo.csv"), index=False)

    print(f"Wrote {os.path.join(OUT_DIR, 'slo.csv')}")


if __name__ == "__main__":
    main()
