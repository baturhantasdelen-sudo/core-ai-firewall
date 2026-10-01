FROM python:3.12-slim
WORKDIR /app
COPY requirements-ci.txt /app/requirements-ci.txt
RUN pip install -q --no-cache-dir -r requirements-ci.txt fastapi uvicorn pydantic
COPY enterprise /app/enterprise
COPY harness/core /app/harness/core
COPY nexus /app/nexus
ENV PYTHONPATH=/app
ENV NEXUS_AIRGAP=true
ENV NEXUS_CLOUD_CONNECT=false
ENV NEXUS_DATA_PLANE_BOOTSTRAP=true
ENV NEXUS_RUNTIME_PORT=8090
EXPOSE 8090
CMD ["python", "-m", "uvicorn", "enterprise.data_plane_api:app", "--host", "0.0.0.0", "--port", "8090"]
