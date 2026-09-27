# Open-source PoC / Exploit preset database

Modular **Detect & Demonstrate** threat presets aligned with disclosed **AI agent CVE-style** scenarios. Each preset is JSON under this directory and is evaluated by the harness policy engine (`harness/core/policy_engine.py`).

## Add a preset

1. Copy an existing `*.preset.json` file.
2. Set unique `preset_id`, `cve_label`, scenario fields (`tool`, `params`, `user_intent`), and fixed `receipt_anchor_utc` for deterministic UAR hashing.
3. Register the file in `manifest.json`.
4. Regenerate public proof bundles:

```bash
python scripts/simulate_vulnerability_preset.py --write-public-json
```

## Run locally

```bash
python scripts/simulate_vulnerability_preset.py --list
python scripts/simulate_vulnerability_preset.py --preset fintech-exfil-reconciliation-2026
python scripts/simulate_vulnerability_preset.py --all
```
