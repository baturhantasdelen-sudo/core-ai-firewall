# Nexus Shield Helm Chart

Install:

```bash
helm upgrade --install nexus-shield . \
  --namespace nexus-shield --create-namespace \
  --set-file apiKey.value=/path/to/api-key.txt
```

Documentation: [docs/ENTERPRISE_HELM_DEPLOY.md](../../../docs/ENTERPRISE_HELM_DEPLOY.md)

Lint (optional):

```bash
helm lint .
helm template test . --set apiKey.value=dev-only-key
```
