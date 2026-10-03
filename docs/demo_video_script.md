# Proving AI Agent Accountability in Real-Time

**Format:** 90-second product demonstration  
**Audience:** Platform engineers, security leaders, and AI agent builders  
**Primary message:** Nexus Shield v2.0 closes the gap between *what an agent claims* and *what actually changed* — with cryptographic proof.

---

## Scene 1 — Hook (0:00–0:12)

| Element | Content |
|--------|---------|
| **Visual** | Split screen: smiling chat UI (“Payment completed ✓”) vs ERP dashboard still showing **PENDING**. |
| **On-screen text** | `HTTP 200 ≠ Verified Outcome` |
| **Voiceover** | “Your agent got a success response. Your ledger did not move. That is false success — and it is how autonomous systems silently fail.” |

---

## Scene 2 — Terminal: Comprehensive Audit (0:12–0:42)

| Element | Content |
|--------|---------|
| **Visual** | Full-screen terminal at repo root. Type and run: `python scripts/run_comprehensive_audit.py` |
| **On-screen text** | `Nexus Shield v2.0 — Comprehensive Accountability Audit` |
| **Voiceover** | “We run Nexus Shield’s live audit harness — not mocks. Three agent profiles hit the real SDK, gateway middleware, outcome engine, and delegation graph.” |

**Highlight on screen (as table scrolls):**

- **Profile A — Compliant Enterprise Agent:** `PASS` · `VERIFIED` AAR · Ed25519 signature valid  
- **Profile B — False-Success Rogue Agent:** `PASS` · `UNVERIFIED` · `FALSE_SUCCESS` incident logged  
- **Profile C — Privilege Escalation:** `PASS` · `HTTP 403` · delegation audit trail  

| Element | Content |
|--------|---------|
| **On-screen text** | `Detection rate: 100%` · `Cryptographic integrity: OK` |
| **Voiceover** | “Compliant flows seal a Universal Action Receipt. Hallucinated success is caught against database state. Escalation attempts die at the gateway — with an immutable audit trail.” |

---

## Scene 3 — Proof Center Dashboard (0:42–1:15)

| Element | Content |
|--------|---------|
| **Visual** | Browser: `https://nexusshield.ai/proof-center` → **Action Verification Center** |
| **On-screen text** | `Action → Outcome → Proof` |

**Beat A — AAR Receipt Inspector (0:45–0:55)**

- Filter: **VERIFIED** vs **UNVERIFIED / False Success**
- Expand JSON; copy **SHA-256 evidence_hash** and **Ed25519 signature**
- **Voiceover:** “Every governed action is inspectable — structured AAR 2.0, tamper-evident hash, portable signature.”

**Beat B — Blast Radius Matrix (0:55–1:05)**

- Show tool × resource matrix; click **Remove stripe_create_transfer**
- Risk score drops in real time
- **Voiceover:** “See blast radius before you deploy — and simulate what-if tool removal.”

**Beat C — Delegation Tree (1:05–1:15)**

- Human → Agent A → Agent B; highlight **Blocked escalation** on sub-agent
- **Voiceover:** “Multi-agent chains inherit least privilege — violations are visible, not silent.”

---

## Scene 4 — Call to Action (1:15–1:30)

| Element | Content |
|--------|---------|
| **Visual** | Logo lockup + three pillars: **Passport · Outcome Verification · AAR 2.0** |
| **On-screen text** | `Nexus Shield — The Agent Accountability Standard` |
| **Voiceover** | “Nexus Shield v2.0 is accountability infrastructure for the agent era — verify outcomes, enforce delegation, and prove every action. Run the audit locally, open the Proof Center, and ship agents your auditors can trust.” |
| **CTA buttons** | `Run Audit` · `Open Proof Center` · `View on GitHub` |

---

## Production checklist

- [ ] Record terminal at 1080p with `run_comprehensive_audit.py` exiting **0**
- [ ] Capture Proof Center with both VERIFIED and UNVERIFIED receipts visible
- [ ] Keep total runtime ≤ 90s (tight cuts on table scroll and JSON expand)
- [ ] Optional lower-third: `core-ai-firewall` monorepo · `pip install -e .`

---

## Commands reference (presenter)

```bash
cd core-ai-firewall
pip install -e ".[dev,proxy]"
python scripts/run_comprehensive_audit.py
cd nexus-shield-dashboard && npm install && npx playwright install chromium
npm run demo:record
# Output: outputs/nexus_shield_demo.mp4
```

### Headless automated recording (CI / demo asset)

```bash
# From repo root (requires ffmpeg on PATH):
python scripts/generate_demo_recording.py
# or:
npm run demo:record
```
