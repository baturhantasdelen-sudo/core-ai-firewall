# Nexus Quantum Guard — Production API Mikroservisi
FROM python:3.12-slim-bookworm

LABEL maintainer="Nexus Quantum Guard"
LABEL version="1.0.0"
LABEL description="Enterprise AI Firewall — FastAPI + Semantic Cache"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY nexus_quantum_guard.py nexus_shield_api.py ./

RUN mkdir -p /app/.cache/huggingface /app/.cache/sentence-transformers

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz | grep -q HEALTHY || exit 1

CMD ["python", "-m", "uvicorn", "nexus_quantum_guard:app", "--host", "0.0.0.0", "--port", "8000"]
