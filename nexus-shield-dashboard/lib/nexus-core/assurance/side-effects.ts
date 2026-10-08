import { resolveAuthoritativeVertical } from '@/lib/nexus-core/assurance/authoritative-sources';
import type {
  ActualSideEffects,
  AssuranceClaimDiff,
  ExpectedSideEffects,
} from '@/lib/nexus-core/assurance/types';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(path);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    }
  }
  return keys;
}

export function analyzeSideEffects(
  expected: ExpectedSideEffects,
  actual: ActualSideEffects,
): AssuranceClaimDiff[] {
  const violations: AssuranceClaimDiff[] = [];
  const state = actual.observed_state;
  const allowed = new Set(expected.allowed_fields);
  const forbidden = new Set(expected.forbidden_fields ?? []);

  for (const [field, value] of Object.entries(expected.expected_mutations)) {
    const observed = state[field];
    if (observed !== value && String(observed) !== String(value)) {
      violations.push({
        field,
        expected: value,
        actual: observed,
        difference: 'Expected mutation not observed',
        severity: /amount|balance/.test(field) ? 'CRITICAL' : 'HIGH',
        authoritative_vertical: resolveAuthoritativeVertical(field),
      });
    }
  }

  for (const key of flattenKeys(state)) {
    const top = key.split('.')[0]!;
    if (forbidden.has(key) || forbidden.has(top)) {
      violations.push({
        field: key,
        expected: undefined,
        actual: state[top],
        difference: 'Forbidden side-effect field present',
        severity: 'HIGH',
        authoritative_vertical: resolveAuthoritativeVertical(key),
      });
    }
    if (allowed.size > 0 && !allowed.has(key) && !allowed.has(top)) {
      const inExpectedMutations = key in expected.expected_mutations || top in expected.expected_mutations;
      if (!inExpectedMutations && state[top] !== undefined) {
        violations.push({
          field: key,
          expected: 'absent or unchanged',
          actual: state[top],
          difference: 'Unauthorized field mutation detected',
          severity: 'MEDIUM',
          authoritative_vertical: resolveAuthoritativeVertical(key),
        });
      }
    }
  }

  if (actual.bulk_update_detected) {
    violations.push({
      field: '_bulk',
      expected: false,
      actual: true,
      difference: 'Bulk update pattern detected',
      severity: 'CRITICAL',
      authoritative_vertical: 'database',
    });
  }

  return violations;
}

export function mergeSideEffectViolations(
  base: AssuranceClaimDiff[],
  side: AssuranceClaimDiff[],
): AssuranceClaimDiff[] {
  const seen = new Set(base.map((d) => d.field));
  const merged = [...base];
  for (const v of side) {
    if (!seen.has(v.field)) merged.push(v);
  }
  return merged;
}
