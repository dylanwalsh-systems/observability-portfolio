#!/usr/bin/env python3
"""
generate_metrics.py
Generates synthetic, pseudo-production metrics for a single service.
Outputs CSV files under ./data for use in Grafana and analysis scripts.

No real data is used. Hostnames/regions are generic. Metrics are simulated.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Dict

import numpy as np
import pandas as pd


@dataclass
class Config:
    service: str = "orders-api"
    regions: List[str] = None
    minutes: int = 60 * 24 * 7  # 7 days of per-minute data
    seed: int = 42
    out_dir: str = "data"

    # Incident window (relative minutes from start)
    incident_start_min: int = 60 * 24 * 3 + 60 * 9   # day 3 at 09:00
    incident_duration_min: int = 90                  # 90 minutes


def ensure_out_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def daily_cycle(minute_index: np.ndarray, minutes_per_day: int = 1440) -> np.ndarray:
    """
    Smooth daily traffic cycle: low at night, peak mid-day.
    Returns a multiplier around ~1.0
    """
    # Shift so peak occurs around mid-day
    phase = 2 * math.pi * (minute_index % minutes_per_day) / minutes_per_day
    # sin wave -> scale to [0.6 .. 1.4] roughly
    return 1.0 + 0.4 * np.sin(phase - math.pi / 2)


def generate(config: Config) -> Dict[str, pd.DataFrame]:
    np.random.seed(config.seed)

    if config.regions is None:
        config.regions = ["us-east", "us-west", "eu-west"]

    # Use UTC timestamps for simplicity
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = end - timedelta(minutes=config.minutes - 1)
    ts = pd.date_range(start=start, end=end, freq="min", tz="UTC")

    minute_index = np.arange(config.minutes)

    # Base traffic pattern (requests per second)
    base_rps = 120 * daily_cycle(minute_index)  # ~72 to ~168
    noise = np.random.normal(loc=0.0, scale=8.0, size=config.minutes)
    rps = np.clip(base_rps + noise, 5, None)

    # Incident: traffic spike + latency degradation + errors
    inc_start = config.incident_start_min
    inc_end = inc_start + config.incident_duration_min
    incident_mask = (minute_index >= inc_start) & (minute_index < inc_end)

    # Add “event” behavior
    rps_inc = rps.copy()
    rps_inc[incident_mask] *= 1.35  # spike traffic during incident

    # Error rate baseline and incident bump
    err_rate = 0.002 + np.random.beta(a=2, b=200, size=config.minutes)  # ~0.2% baseline-ish
    err_rate[incident_mask] += 0.02  # +2% during incident
    err_rate = np.clip(err_rate, 0, 0.2)

    # Latency model (milliseconds) with tail behavior
    # baseline p50 around 80-120ms, p95 around 180-260ms, p99 around 350-500ms
    base_p50 = 90 + 15 * daily_cycle(minute_index) + np.random.normal(0, 5, config.minutes)
    base_p95 = base_p50 * 2.1 + np.random.normal(0, 10, config.minutes)
    base_p99 = base_p50 * 3.8 + np.random.normal(0, 20, config.minutes)

    # During incident, degrade latency and tails more than median
    base_p50[incident_mask] *= 1.6
    base_p95[incident_mask] *= 2.0
    base_p99[incident_mask] *= 2.4

    # Region variations
    region_latency_bias = {
        "us-east": 1.00,
        "us-west": 1.10,
        "eu-west": 1.18,
    }

    # Build per-region frames
    traffic_rows = []
    error_rows = []
    latency_rows = []

    for region in config.regions:
        bias = region_latency_bias.get(region, 1.0)

        # Small region noise
        rps_region = np.clip(rps_inc * np.random.normal(1.0, 0.03, config.minutes), 1, None)

        # Errors proportional to traffic
        requests_per_min = rps_region * 60.0
        errors = np.round(requests_per_min * err_rate * np.random.normal(1.0, 0.05, config.minutes)).astype(int)
        errors = np.clip(errors, 0, None)

        # Latency per region
        p50 = np.clip(base_p50 * bias * np.random.normal(1.0, 0.02, config.minutes), 20, None)
        p95 = np.clip(base_p95 * bias * np.random.normal(1.0, 0.03, config.minutes), p50, None)
        p99 = np.clip(base_p99 * bias * np.random.normal(1.0, 0.04, config.minutes), p95, None)

        traffic_rows.append(pd.DataFrame({
            "ts": ts,
            "service": config.service,
            "region": region,
            "rps": np.round(rps_region, 2),
        }))

        error_rows.append(pd.DataFrame({
            "ts": ts,
            "service": config.service,
            "region": region,
            "error_rate": np.round(err_rate, 5),
            "errors_per_min": errors,
        }))

        latency_rows.append(pd.DataFrame({
            "ts": ts,
            "service": config.service,
            "region": region,
            "p50_ms": np.round(p50, 2),
            "p95_ms": np.round(p95, 2),
            "p99_ms": np.round(p99, 2),
        }))

    traffic_df = pd.concat(traffic_rows, ignore_index=True)
    errors_df = pd.concat(error_rows, ignore_index=True)
    latency_df = pd.concat(latency_rows, ignore_index=True)

    incidents_df = pd.DataFrame([{
        "service": config.service,
        "incident_name": "INC-001: latency + errors during peak traffic",
        "start_ts": ts[inc_start],
        "end_ts": ts[min(inc_end, len(ts)-1)],
        "summary": "Traffic spike coincides with elevated tail latency and higher error rates.",
        "suspected_cause": "Capacity saturation and downstream dependency slowness (synthetic).",
    }])

    return {
        "traffic": traffic_df,
        "errors": errors_df,
        "latency": latency_df,
        "incidents": incidents_df,
    }


def main() -> None:
    config = Config(regions=["us-east", "us-west", "eu-west"])
    ensure_out_dir(config.out_dir)

    frames = generate(config)

    frames["traffic"].to_csv(os.path.join(config.out_dir, "traffic.csv"), index=False)
    frames["errors"].to_csv(os.path.join(config.out_dir, "errors.csv"), index=False)
    frames["latency"].to_csv(os.path.join(config.out_dir, "latency.csv"), index=False)
    frames["incidents"].to_csv(os.path.join(config.out_dir, "incidents.csv"), index=False)

    print("Wrote:")
    for name in ["traffic.csv", "errors.csv", "latency.csv", "incidents.csv"]:
        print(f"  - {os.path.join(config.out_dir, name)}")


if __name__ == "__main__":
    main()
