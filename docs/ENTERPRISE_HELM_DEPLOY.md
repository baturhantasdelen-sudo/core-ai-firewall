# Enterprise Production Deployment (Helm & Air-Gapped Kubernetes)

Deploy Nexus Shield on **EKS, AKS, GKE, or private clusters** with a single Helm release. The chart targets the **lightweight Fast API** (`/v1/shield`, Proof Center, governance routes). Optional **ML API** (PyTorch) is behind `ml.enabled`.

**Trust & architecture:** [TRUST_CENTER_ENTERPRISE.md](./TRUST_CENTER_ENTERPRISE.md) · [architecture-whitepaper.md](./architecture-whitepaper.md)

Chart path: [`deploy/helm/nexus-shield/`](../deploy/helm/nexus-shield/)

## Prerequisites

- Kubernetes 1.25+
- Helm 3.10+
- Container images mirrored to your registry for **air-gapped** sites
- API key material in **Kubernetes Secrets**, **Sealed Secrets**, or **External Secrets** (Vault)

## Quick install (connected cluster)

```bash
openssl rand -hex 32 > /tmp/nexus-api-key.txt

helm upgrade --install nexus-shield ./deploy/helm/nexus-shield \
  --namespace nexus-shield --create-namespace \
  --set-file apiKey.value=/tmp/nexus-api-key.txt \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=shield.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

Verify:

```bash
kubectl -n nexus-shield port-forward svc/nexus-shield-nexus-shield-fast 8080:8080
curl -fsS http://127.0.0.1:8080/healthz
```

## Secret management

### Existing Kubernetes Secret (recommended)

Create the secret out-of-band (GitOps, kubectl, or CI):

```bash
kubectl -n nexus-shield create secret generic nexus-shield-api-key \
  --from-literal=nexus-api-key="$(openssl rand -hex 32)"
```

Install chart:

```yaml
apiKey:
  create: false
  existingSecret: nexus-shield-api-key
  secretKey: nexus-api-key
```

### HashiCorp Vault via External Secrets Operator

Enable in `values.yaml`:

```yaml
apiKey:
  create: false
  existingSecret: nexus-shield-api-key

externalSecrets:
  enabled: true
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  remoteRef:
    key: secret/nexus-shield
    property: nexus-api-key
```

The chart renders an `ExternalSecret` that syncs Vault → Kubernetes Secret consumed by the Deployment.

### AWS Secrets Manager (External Secrets Operator)

Use a `ClusterSecretStore` backed by AWS Secrets Manager and the same `externalSecrets.remoteRef` shape (`key` = secret ARN or name, `property` = JSON field). The Deployment still mounts a normal Kubernetes Secret — no credentials in Helm values or git.

## Air-gapped / private registry

1. Load images into your registry (example tags):

   - `nexusshield/nexus-shield-fast:<tag>`
   - `nexusshield/nexus-quantum-guard:<tag>` (if `ml.enabled`)

2. Install with overrides:

```bash
helm upgrade --install nexus-shield ./deploy/helm/nexus-shield \
  --namespace nexus-shield --create-namespace \
  --set global.airGap=true \
  --set fastApi.image.repository=registry.internal/nexus-shield-fast \
  --set fastApi.image.tag=2026.10.1 \
  --set imagePullSecrets[0].name=internal-registry \
  --set apiKey.existingSecret=nexus-shield-api-key
```

3. No outbound internet is required at runtime when images and secrets are local.

## Optional ML API (PyTorch)

Requires large nodes and image pull bandwidth:

```yaml
ml:
  enabled: true
  image:
    repository: registry.internal/nexus-quantum-guard
    tag: latest
```

## Values reference (high level)

| Key | Description |
|-----|-------------|
| `fastApi.image.*` | Fast API image repository/tag |
| `ml.enabled` | Deploy ML `nexus-api` Deployment |
| `apiKey.existingSecret` | Use pre-created Secret |
| `externalSecrets.enabled` | Vault / ESO integration |
| `ingress.enabled` | Expose via Ingress |
| `imagePullSecrets` | Air-gap registry credentials |

Run `helm show values deploy/helm/nexus-shield` for the full list.

## Compose vs Helm

| Surface | Use when |
|---------|----------|
| `docker-compose.prod.yml` | Single VM / GCP edge (see [DEPLOYMENT.md](../DEPLOYMENT.md)) |
| Helm chart | Multi-tenant K8s, GitOps, Vault secrets, horizontal scale |

## Uninstall

```bash
helm uninstall nexus-shield -n nexus-shield
```
