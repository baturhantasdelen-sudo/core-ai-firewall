FROM python:3.11-slim

WORKDIR /app

# Install nexus-shield-cli directly from PyPI
RUN pip install --no-cache-dir nexus-shield-cli

EXPOSE 8080

# Run proxy by default (0.0.0.0 required for container port mapping)
ENTRYPOINT ["nexus-shield", "proxy"]
CMD ["--host", "0.0.0.0", "-p", "8080", "--mask-all"]
