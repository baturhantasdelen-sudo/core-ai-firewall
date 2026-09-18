# Start Streamlit Command Center on port 8501 (recommended: separate terminal)
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .venv)) { python -m venv .venv }
$env:TELEMETRY_DB_PATH = "data/telemetry.db"
$env:STREAMLIT_BROWSER_GATHER_USAGE_STATS = "false"
$env:STREAMLIT_TELEMETRY_ENABLED = "false"
.venv\Scripts\streamlit run app/dashboard.py `
    --server.port 8501 `
    --server.address localhost `
    --server.headless true `
    --browser.gatherUsageStats false
