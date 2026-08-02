# ⚡ Nexus Shield: Sub-10ms PII Guardrail for LLMs

Nexus Shield is an in-RAM pattern buffer proxy designed to strip PII (SSN, Credit Cards, API Keys, Emails) before forwarding payloads to OpenAI, LiteLLM, or LangChain—without killing stream TTL.

### 📊 Performance Comparison (300 Payloads Benchmark)

| Engine | Avg Latency (P50) | P99 Latency | Memory Overhead |
| :--- | :---: | :---: | :---: |
| **Nexus Shield (In-RAM)** | **< 2.4 ms** | **< 6.1 ms** | **~12 MB** |
| Standard Python Regex | 18.2 ms | 45.1 ms | ~45 MB |
| MS Presidio (spaCy NER) | 120.5 ms | 245.0 ms | ~450 MB |

### 🚀 Quick Start

```python
from nexus_shield import NexusClient

nexus = NexusClient(base_url="https://api.nexusshield.ai/v1", api_key="nx_live_...")
config = nexus.get_proxy_config()
```
