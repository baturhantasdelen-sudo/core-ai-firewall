# Start FastAPI proxy gateway (NexusShield + ResoNet) on port 8080
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .venv)) { python -m venv .venv }
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
