import type { UarV2Receipt } from '@/lib/nexus-core/schemas/uar-v2';

export function formatExecutiveAuditJson(receipt: UarV2Receipt): string {
  return JSON.stringify(
    {
      report_type: 'Nexus Shield Executive Accountability Audit',
      generated_at: new Date().toISOString(),
      receipt,
      verification_checklist: {
        sha256_action_proof_bound: receipt.cryptographic_anchor.binding_valid,
        five_dimensional_trace_complete: Boolean(receipt.trace.who && receipt.trace.outcome),
        ed25519_signature_present: receipt.cryptographic_anchor.signature.startsWith('sig_nexus_ed25519_'),
      },
    },
    null,
    2,
  );
}

export function formatExecutiveAuditHtml(receipt: UarV2Receipt, headline: string, summary: string): string {
  const trace = receipt.trace;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nexus Shield Executive Audit</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 820px; margin: 2rem auto; color: #111; line-height: 1.5; }
    h1 { font-size: 1.35rem; }
    .meta { color: #555; font-size: 0.85rem; }
    h2 { font-size: 1rem; margin-top: 1.5rem; border-bottom: 1px solid #ddd; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.78rem; word-break: break-all; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 0.75rem; }
  </style>
</head>
<body>
  <h1>${headline}</h1>
  <p class="meta">Receipt ${receipt.receipt_id} · ${receipt.timestamp} · Decision ${receipt.decision}</p>
  <p>${summary}</p>
  <h2>5-dimensional trace</h2>
  <div class="grid">
    <div class="card"><strong>who</strong><br/>${trace.who.agent_id}</div>
    <div class="card"><strong>can</strong><br/>${trace.can.effective_scopes.join(', ')}</div>
    <div class="card"><strong>why</strong><br/>${trace.why.user_intent}</div>
    <div class="card"><strong>did</strong><br/>${trace.did.tool_name}</div>
    <div class="card"><strong>outcome</strong><br/>${trace.outcome.status}${trace.outcome.divergence_reason ? ` — ${trace.outcome.divergence_reason}` : ''}</div>
  </div>
  <h2>Cryptographic anchor</h2>
  <p class="mono">evidence_hash: ${receipt.cryptographic_anchor.evidence_hash}</p>
  <p class="mono">actionProofHash: ${receipt.cryptographic_anchor.action_proof.actionProofHash}</p>
  <p class="mono">binding_valid: ${receipt.cryptographic_anchor.binding_valid}</p>
  <p class="mono">signature: ${receipt.cryptographic_anchor.signature}</p>
  <p style="margin-top:2rem;font-size:0.75rem;color:#666;">Print to PDF (Ctrl+P) for court-grade distribution.</p>
</body>
</html>`;
}
