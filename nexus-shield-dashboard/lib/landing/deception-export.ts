import type { DeceptionScenario, DeceptionUarReceipt } from '@/lib/landing/deception-demo';

export function downloadUarJson(receipt: DeceptionUarReceipt, filename: string): void {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadExecutiveReportHtml(scenario: DeceptionScenario): void {
  const { executiveReport, uarReceipt, pillLabel } = scenario;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nexus Shield Executive Audit Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #111; line-height: 1.5; }
    h1 { font-size: 1.35rem; margin-bottom: 0.25rem; }
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1rem; margin-top: 1.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    ul { padding-left: 1.25rem; }
    .rec { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 8px; margin-top: 1rem; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>${executiveReport.headline}</h1>
  <p class="meta">Nexus Shield · Scenario: ${pillLabel} · Receipt ${uarReceipt.receipt_id} · ${uarReceipt.timestamp}</p>
  <h2>Executive summary</h2>
  <p>${executiveReport.summary}</p>
  <h2>Key findings</h2>
  <ul>${executiveReport.findings.map((f) => `<li>${f}</li>`).join('')}</ul>
  <div class="rec"><strong>Recommendation:</strong> ${executiveReport.recommendation}</div>
  <h2>Action proof (UAR v2)</h2>
  <p class="mono">intentHash: ${uarReceipt.action_proof.intentHash}</p>
  <p class="mono">policyHash: ${uarReceipt.action_proof.policyHash}</p>
  <p class="mono">toolCallHash: ${uarReceipt.action_proof.toolCallHash}</p>
  <p class="mono">transactionId: ${uarReceipt.action_proof.transactionId}</p>
  <p class="mono">resultHash: ${uarReceipt.action_proof.resultHash}</p>
  <p class="mono">actionProofHash: ${uarReceipt.action_proof.actionProofHash}</p>
  <h2>Evidence reference</h2>
  <p class="mono">evidence_hash: ${uarReceipt.cryptographic_proof.evidence_hash}</p>
  <p class="mono">signature: ${uarReceipt.cryptographic_proof.signature}</p>
  <p style="margin-top:2rem;font-size:0.75rem;color:#666;">Print this page to PDF (Ctrl+P) for board-ready distribution.</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Nexus-Shield-Executive-Audit-${scenario.id}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
