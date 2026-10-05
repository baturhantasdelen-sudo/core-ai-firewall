# Repository split (Web vs Mobile)

| Repository | Purpose | Primary paths |
|------------|---------|----------------|
| [core-ai-firewall](https://github.com/baturhantasdelen-sudo/core-ai-firewall) | Nexus Shield web platform (`nexusshield.ai`), Next.js dashboard, backend engines, Python/TS SDKs, policy-as-code | `nexus-shield-dashboard/`, `packages/python/`, `lib/` engines |
| [nexus-shield](https://github.com/baturhantasdelen-sudo/nexus-shield) | Personal Guard mobile app (Flutter + native bridges) | `nexusshield_mobile/` |

Do not add `nexusshield_mobile/` to the web repository. Clone the mobile repo for Flutter work.
