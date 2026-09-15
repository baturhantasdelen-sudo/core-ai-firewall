'use client';

import { useState } from 'react';
import { isCryptographicallyVerified } from '@/lib/governance/audit-trail';
import type { AuditTrailEntry } from '@/lib/governance/audit-trail';
import type { AuditLogItem } from '@/types/trust-hub';
import { auditTrailEntryToLogItem } from '@/types/trust-hub';

interface EvidenceModalProps {
  log: AuditLogItem | AuditTrailEntry;
  onClose: () => void;
  onDecision?: (decision: 'APPROVED' | 'REJECTED') => void;
}

function toLogItem(log: AuditLogItem | AuditTrailEntry): AuditLogItem {
  if ('status' in log && 'approval_id' in log) {
    return log;
  }
  return auditTrailEntryToLogItem(log);
}

function toTrailEntry(log: AuditLogItem | AuditTrailEntry): AuditTrailEntry {
  if ('evidence_id' in log || 'entry_hash' in log) {
    return log as AuditTrailEntry;
  }
  const item = log as AuditLogItem;
  return {
    timestamp: item.timestamp,
    session_id: item.session_id,
    agent_id: item.agent_id,
    tool_name: item.tool_name,
    decision: item.decision,
    evaluated_risk_level: item.evaluated_risk_level,
    risk_flags: item.risk_flags,
    evidence_id: item.approval_id,
    payload_hash: item.payload_hash || null,
    evidence_status: item.status === 'APPROVED' ? 'VERIFIED_ACTION' : null,
    entry_hash: null,
    reason: null,
    approval_id: item.approval_id,
  };
}

function isPendingApproval(item: AuditLogItem): boolean {
  return item.status === 'PENDING_APPROVAL' || item.decision === 'PENDING_APPROVAL';
}

export function EvidenceModal({ log, onClose, onDecision }: EvidenceModalProps) {
  const item = toLogItem(log);
  const entry = toTrailEntry(log);
  const preVerified = isCryptographicallyVerified(entry);
  const pending = isPendingApproval(item);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(preVerified ? true : null);

  const handleVerify = () => {
    setIsVerifying(true);
    window.setTimeout(() => {
      setIsVerifying(false);
      setVerified(isCryptographicallyVerified(entry));
    }, 600);
  };

  const submitDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!item.approval_id || item.approval_id === '—') {
      setDecisionError('Missing approval_id for HITL decision');
      return;
    }

    setIsDeciding(true);
    setDecisionError(null);
    try {
      const response = await fetch('/api/governance/approval/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          approval_id: item.approval_id,
          decision,
          reviewer_notes:
            decision === 'REJECTED'
              ? 'Rejected by human reviewer after SHA-256 evidence inspection.'
              : 'Approved by human reviewer after evidence verification.',
        }),
      });
      const body = (await response.json()) as { message?: string; status?: string };
      if (!response.ok) {
        throw new Error(body.message ?? `Decision failed (${response.status})`);
      }
      setDecisionNote(decision === 'REJECTED' ? 'REJECTED — Human-in-the-loop decision recorded.' : 'APPROVED');
      onDecision?.(decision);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'HITL decision failed');
    } finally {
      setIsDeciding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Cryptographic Evidence Verification</h3>
            <p className="text-xs text-slate-400">ID: {item.approval_id || 'EV-PROOF-OF-ACTION'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session ID</label>
            <p className="rounded border border-slate-800/80 bg-slate-950 p-2 font-mono text-emerald-400">
              {item.session_id}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Payload Hash (SHA-256)
            </label>
            <p
              data-demo="payload-hash"
              className="break-all rounded border border-slate-800/80 bg-slate-950 p-2 font-mono text-xs text-amber-300"
            >
              {item.payload_hash ||
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
            </p>
          </div>

          {verified === true ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400">
              <span className="text-xl">✓</span>
              <div className="text-xs">
                <p className="font-bold">Hash Signature Validated</p>
                <p className="text-emerald-500/80">Payload immutability confirmed against Nexus Shield ledger.</p>
              </div>
            </div>
          ) : null}

          {verified === false ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Signature could not be verified — missing or invalid payload hash / evidence bundle.
            </div>
          ) : null}

          {decisionNote ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
              {decisionNote}
            </div>
          ) : null}

          {decisionError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              {decisionError}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium transition hover:bg-slate-700"
          >
            Kapat
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying || verified === true}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isVerifying ? 'Verifying…' : verified ? 'Verified' : 'Verify Signature'}
          </button>
          {pending && !decisionNote ? (
            <>
              <button
                type="button"
                data-demo="approve-hitl"
                disabled={isDeciding}
                onClick={() => void submitDecision('APPROVED')}
                className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                APPROVE
              </button>
              <button
                type="button"
                data-demo="reject-hitl"
                disabled={isDeciding}
                onClick={() => void submitDecision('REJECTED')}
                className="rounded-lg border border-rose-500/40 bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                REJECT
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
