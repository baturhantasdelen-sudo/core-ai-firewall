import type { OutcomeDiff } from '@/lib/nexus-core/outcome/models';
import type { ClassifiedOutcomeDiff, DiffClassification } from '@/lib/nexus-core/assurance-engine/types';

function classify(field: string, expected: unknown, actual: unknown, severity: OutcomeDiff['severity']): DiffClassification {
  if (/amount|refund_amount|payment_amount/.test(field)) return 'TRANSACTION_AMOUNT_MISMATCH';
  if (/currency/.test(field)) return 'TRANSACTION_STATUS_MISMATCH';
  if (/invoice|target|resource_id|customer/.test(field)) return 'RESOURCE_ID_MISMATCH';
  if (/status|payment_status|refund_status/.test(field)) return 'TRANSACTION_STATUS_MISMATCH';
  if (/records_changed|mutation_count|_bulk/.test(field)) return 'RESOURCE_COUNT_EXPLOSION';
  if (/extra_|shadow_|prohibited/.test(field)) return 'SIDE_EFFECT_VIOLATION';
  if (severity === 'CRITICAL') return 'FIELD_MISMATCH';
  return 'FIELD_MISMATCH';
}

export function classifyDiffs(diffs: OutcomeDiff[]): ClassifiedOutcomeDiff[] {
  return diffs.map((d) => {
    const classification = classify(d.field, d.expected, d.actual, d.severity);
    return {
      ...d,
      classification,
      critical: d.severity === 'CRITICAL' || d.severity === 'HIGH',
      message: d.difference || `${d.field} mismatch`,
      operator: 'EQUALS',
    };
  });
}

export function diffsFromFieldMismatch(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): ClassifiedOutcomeDiff[] {
  const out: ClassifiedOutcomeDiff[] = [];
  for (const [field, exp] of Object.entries(expected)) {
    const act = actual[field];
    if (act !== exp && String(act) !== String(exp)) {
      const severity =
        /amount|refund/.test(field) && Number(exp) !== Number(act) ? ('CRITICAL' as const) : ('HIGH' as const);
      out.push({
        field,
        expected: exp,
        actual: act,
        difference: `${field} expected ${String(exp)} got ${String(act)}`,
        severity,
        classification: classify(field, exp, act, severity),
        critical: severity === 'CRITICAL',
        message: `${field} mismatch`,
        operator: 'EQUALS',
      });
    }
  }
  return out;
}
