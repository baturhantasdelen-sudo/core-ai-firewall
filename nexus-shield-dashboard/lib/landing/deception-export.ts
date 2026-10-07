import type { DeceptionScenario, DeceptionUarReceipt } from '@/lib/landing/deception-demo';
import { formatExecutiveAuditHtml as formatCoreExecutiveHtml } from '@/lib/nexus-core/executive-export';
import type { UarV2Receipt } from '@/lib/nexus-core/schemas/uar-v2';

export function downloadUarJson(receipt: DeceptionUarReceipt, filename: string): void {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Map landing demo receipt to core UAR v2 shape for executive export. */
export function deceptionReceiptToUarV2(receipt: DeceptionUarReceipt): UarV2Receipt {
  const ap = receipt.action_proof;
  return {
    $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
    receipt_id: receipt.receipt_id,
    timestamp: receipt.timestamp,
    trace: {
      who: { agent_id: receipt.agent.identity, passport_id: receipt.agent.passport_id },
      can: {
        effective_scopes: receipt.authority.allowed_scopes,
        authority_hash: ap.policyHash,
      },
      why: { user_intent: receipt.intent.raw_prompt, intent_hash: ap.intentHash },
      did: {
        tool_name: receipt.execution.tool_called,
        tool_call_hash: ap.toolCallHash,
        transaction_id: ap.transactionId,
      },
      outcome: {
        status: receipt.outcome_verification.status,
        result_hash: ap.resultHash,
        adapter_system: 'INLINE_STATE',
        divergence_reason: receipt.outcome_verification.discrepancy_detected
          ? 'False Success / Ghost Action detected'
          : undefined,
      },
    },
    cryptographic_anchor: {
      evidence_hash: receipt.cryptographic_proof.evidence_hash,
      signature: receipt.cryptographic_proof.signature,
      action_proof: ap,
      binding_valid: receipt.cryptographic_proof.evidence_hash === ap.actionProofHash,
    },
    decision: receipt.policy.evaluation,
    agent_status: receipt.outcome_verification.status === 'UNVERIFIED' ? 'READ_ONLY' : 'ACTIVE',
    capabilities_revoked: receipt.outcome_verification.status === 'UNVERIFIED',
  };
}

export function downloadExecutiveReportHtml(scenario: DeceptionScenario): void {
  const { executiveReport, uarReceipt } = scenario;
  const html = formatCoreExecutiveHtml(
    deceptionReceiptToUarV2(uarReceipt),
    executiveReport.headline,
    executiveReport.summary,
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Nexus-Shield-Executive-Audit-${scenario.id}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
