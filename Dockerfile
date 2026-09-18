# Nexus Quantum Guard — Production API (single-stage)
# syntax=docker/dockerfile:1

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && groupadd --system --gid 1000 nexus \
    && useradd --system --uid 1000 --gid nexus --home-dir /app --shell /usr/sbin/nologin nexus

COPY requirements-docker.txt requirements.txt
RUN --mount=type=tmpfs,target=/tmp \
    pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*

COPY nexus_quantum_guard.py nexus_shield_api.py nexus_observability.py ./

RUN --mount=type=tmpfs,target=/tmp \
    mkdir -p /app/.cache/huggingface /app/.cache/sentence-transformers \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')" \
    && python -c "from nexus_quantum_guard import bake_reference_matrix; bake_reference_matrix()" \
    && python -c "import torch, uvicorn, sentence_transformers" \
    && chown -R nexus:nexus /app

USER nexus

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/healthz | grep -q HEALTHY || exit 1

CMD ["python", "-m", "uvicorn", "nexus_shield_api:app", "--host", "0.0.0.0", "--port", "8000"]
