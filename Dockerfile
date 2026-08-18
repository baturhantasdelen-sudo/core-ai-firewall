# Nexus Quantum Guard — Production API (multi-stage, lightweight)
# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build Python dependencies + bake embedding model
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt requirements.txt

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --upgrade pip \
    && pip install torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt

RUN mkdir -p /app/.cache/huggingface /app/.cache/sentence-transformers \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY nexus_quantum_guard.py nexus_shield_api.py nexus_observability.py /build/
RUN python -c "from nexus_quantum_guard import bake_reference_matrix; bake_reference_matrix()"

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime image
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runtime

LABEL maintainer="Nexus Quantum Guard" \
      version="1.0.0" \
      description="Enterprise AI Firewall — FastAPI + Semantic Cache"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers \
    TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1000 nexus \
    && useradd --system --uid 1000 --gid nexus --home-dir /app --shell /usr/sbin/nologin nexus

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app/.cache /app/.cache

COPY nexus_quantum_guard.py nexus_shield_api.py nexus_observability.py ./

RUN chown -R nexus:nexus /app

USER nexus

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz | grep -q HEALTHY || exit 1

CMD ["python", "-m", "uvicorn", "nexus_quantum_guard:app", "--host", "0.0.0.0", "--port", "8000"]
