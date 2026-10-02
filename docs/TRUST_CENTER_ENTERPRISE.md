# Trust Center — Enterprise deployment & security signals

**Product:** Nexus Shield Action Control Plane & UAR Generator  
**Audience:** CISO, platform engineering, procurement / security review  
**Live:** [Dashboard Trust Page](https://nexus-shield-dashboard.vercel.app/trust) · [Trust Hub](https://nexus-shield-dashboard.vercel.app/dashboard/trust-hub)

---

## 1. Deployment experience

### Helm & Kubernetes

Install the full lightweight production stack with one Helm release:

- **Fast API** — governance routes, Proof Center, `/v1/shield`, sandbox-compatible APIs
- **Optional ML engine** — PyTorch pipeline (`ml.enabled`)
- **Optional nginx gateway** — edge routing when not using your own ingress

```bash
helm upgrade --install nexus-shield ./deploy/helm/nexus-shield \
  --namespace nexus-shield --create-namespace \
  --set-file apiKey.value=/tmp/nexus-api-key.txt
```

Guide: [ENTERPRISE_HELM_DEPLOY.md](./ENTERPRISE_HELM_DEPLOY.md)

GitOps and **Operator-style** lifecycle (upgrade/rollback, drift detection) map cleanly to Helm + Argo CD / Flux; chart templates are the source of truth for cluster state.

### Docker Compose (fast PoC)

| Stack | Use case |
|-------|----------|
| [`docker-compose.nexus-reference.yml`](../docker-compose.nexus-reference.yml) | Phase 1–4 reference sidecar + mock MCP |
| [`nexus-reference-app/`](../nexus-reference-app/) | Minimal `docker compose up` lab |
| [`deployments/enterprise-demo/`](../deployments/enterprise-demo/) | LangChain-style intercept demo on `:8090` |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | Single-VM production (GCP) |

CLI: `nexus-shield reference up --build -d` — [QUICKSTART_DEVELOPER.md](./QUICKSTART_DEVELOPER.md)

### Secret management

| Backend | Integration |
|---------|-------------|
| **Kubernetes Secrets** | `apiKey.existingSecret` in Helm values |
| **HashiCorp Vault** | `externalSecrets.enabled` + External Secrets Operator → K8s Secret |
| **AWS Secrets Manager** | Same ESO pattern with `ClusterSecretStore` for AWS (remote ref key/property) |

Sensitive values are **never** committed to git; CI injects production secrets via GitHub Actions → server `.env` for VM deploys only.

Chart reference: [`deploy/helm/nexus-shield/values.yaml`](../deploy/helm/nexus-shield/values.yaml)

---

## 2. Air-gapped architecture & in-boundary flow

Data and decisions stay inside the customer environment unless **you** configure optional cloud dashboard or LLM egress.

```
┌────────────────── Customer infrastructure (air-gap capable) ──────────────────┐
│                                                                                 │
│  Agent ──► Intent ──► Authority ──► Policy ──► Decision ──► Action ──► UAR     │
│                                                                                 │
│  ◄── No required Nexus Cloud · optional local LLM only ──►                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Air-gapped guarantee:** `NEXUS_CLOUD_CONNECT=false` default — [architecture-whitepaper.md](./architecture-whitepaper.md)
- **Zero telemetry:** no mandatory outbound product telemetry from the data plane
- **Control plane optional:** Nexus Cloud is opt-in for license/SIEM fan-out — [DATA_PLANE_AND_CONTROL_PLANE.md](./DATA_PLANE_AND_CONTROL_PLANE.md)

---

## 3. Four security signals (low cost, high trust)

| Signal | Statement |
|--------|-----------|
| **Data privacy** | Nexus Shield does **not** exfiltrate prompt or action payload content to Nexus-operated systems in self-hosted / air-gapped modes. |
| **Threat model & whitepaper** | [architecture-whitepaper.md](./architecture-whitepaper.md) — CISO depth on planes, UAR, benchmarks vs production proof. |
| **Open source credibility** | Governance runtime (MIT), harness (Apache 2.0); auditable source; generate SBOMs from published container images with standard tooling (Syft, Trivy). |
| **PoC sandbox** | `/api/sandbox` on the landing playground; local reference stack without production API keys. |

Compliance mapping: [COMPLIANCE_READINESS.md](./COMPLIANCE_READINESS.md)

---

## 4. Contact

Security & privacy: **security@nexusshield.ai**
