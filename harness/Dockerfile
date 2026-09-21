FROM python:3.12-slim

WORKDIR /harness

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir -r python/requirements.txt 2>/dev/null || true

ENTRYPOINT ["python", "scripts/run_reproducible_benchmark.py"]
CMD ["--eval-mcp"]
