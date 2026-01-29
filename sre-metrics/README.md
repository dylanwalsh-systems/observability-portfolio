# Synthetic SRE Metrics (Python)

This project generates pseudo-production time series data (latency, errors, traffic) for an example service.
It also computes basic SLO/error-budget signals to support Grafana dashboards and incident analysis.

**All data is synthetic** and generated locally for demonstration purposes.

## Outputs
- `data/latency.csv` — per-minute latency percentiles (p50/p95/p99)
- `data/errors.csv` — per-minute error rate and counts
- `data/traffic.csv` — per-minute request volume (RPS)
- `data/incidents.csv` — annotated incident windows

## How to run
```bash
python3 generate_metrics.py
python3 analyze_slo.py
