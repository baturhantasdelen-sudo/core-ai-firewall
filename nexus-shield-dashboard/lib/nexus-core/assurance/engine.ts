import { resolveAuthoritativeVertical } from '@/lib/nexus-core/assurance/authoritative-sources';
import type {
  AssuranceClaimDiff,
  AssuranceEvaluationResult,
  AssuranceOperator,
  AssuranceRule,
  AssuranceRuleGroup,
  AssuranceSeverity,
} from '@/lib/nexus-core/assurance/types';
import { evaluateOperator as outcomeEvaluateOperator } from '@/lib/nexus-core/outcome/engine';
import type { ConstraintOperator } from '@/lib/nexus-core/outcome/models';

function isGroup(rule: AssuranceRule | AssuranceRuleGroup): rule is AssuranceRuleGroup {
  return 'logic' in rule && 'rules' in rule;
}

function normalizeOperator(op: AssuranceOperator): ConstraintOperator {
  if (op === 'GREATER') return 'GREATER_THAN';
  if (op === 'LESS') return 'LESS_THAN';
  return op as ConstraintOperator;
}

export function evaluateAssuranceOperator(
  operator: AssuranceOperator,
  actual: unknown,
  expected?: unknown,
): boolean {
  if (operator === 'MATCHES') {
    return outcomeEvaluateOperator('MATCHES', actual, expected);
  }
  return outcomeEvaluateOperator(normalizeOperator(operator), actual, expected);
}

function severityFor(field: string, expected: unknown, actual: unknown): AssuranceSeverity {
  if (/amount|balance|payment|invoice/.test(field.toLowerCase())) {
    const e = Number(expected);
    const a = Number(actual);
    if (!Number.isNaN(e) && !Number.isNaN(a)) {
      const ratio = Math.abs(e - a) / Math.max(Math.abs(e), 1);
      if (ratio >= 0.5 || Math.abs(e - a) >= 10000) return 'CRITICAL';
      if (ratio >= 0.1) return 'HIGH';
    }
  }
  if (/segment|permission|role|deleted/.test(field.toLowerCase())) return 'HIGH';
  return 'MEDIUM';
}

function getFieldValue(state: Record<string, unknown>, field: string): unknown {
  if (field in state) return state[field];
  const parts = field.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function assuranceRuleToDiff(state: Record<string, unknown>, rule: AssuranceRule): AssuranceClaimDiff | null {
  const actual = getFieldValue(state, rule.field);
  const ok = evaluateAssuranceOperator(rule.operator, actual, rule.value);
  if (ok) return null;
  const vertical = rule.authoritative_vertical ?? resolveAuthoritativeVertical(rule.field);
  return {
    field: rule.field,
    expected: rule.value,
    actual,
    difference: `${rule.field} failed ${rule.operator}`,
    severity: severityFor(rule.field, rule.value, actual),
    authoritative_vertical: vertical,
  };
}

function evaluateAssuranceGroupInternal(
  state: Record<string, unknown>,
  group: AssuranceRuleGroup,
): { passed: boolean; diffs: AssuranceClaimDiff[] } {
  if (group.logic === 'ALL') {
    const diffs: AssuranceClaimDiff[] = [];
    for (const rule of group.rules) {
      if (isGroup(rule)) {
        const nested = evaluateAssuranceGroupInternal(state, rule);
        if (!nested.passed) diffs.push(...nested.diffs);
      } else {
        const diff = assuranceRuleToDiff(state, rule);
        if (diff) diffs.push(diff);
      }
    }
    return { passed: diffs.length === 0, diffs };
  }
  const failing: AssuranceClaimDiff[] = [];
  let anyPass = false;
  for (const rule of group.rules) {
    if (isGroup(rule)) {
      const nested = evaluateAssuranceGroupInternal(state, rule);
      if (nested.passed) anyPass = true;
      else failing.push(...nested.diffs);
    } else {
      const diff = assuranceRuleToDiff(state, rule);
      if (!diff) anyPass = true;
      else failing.push(diff);
    }
  }
  return { passed: anyPass, diffs: anyPass ? [] : failing };
}

function evaluateAssuranceGroup(
  state: Record<string, unknown>,
  group: AssuranceRuleGroup,
): AssuranceClaimDiff[] {
  return evaluateAssuranceGroupInternal(state, group).diffs;
}

export function evaluateAssuranceRules(
  state: Record<string, unknown>,
  rules: AssuranceRuleGroup,
): AssuranceEvaluationResult {
  const claim_diffs = evaluateAssuranceGroup(state, rules);
  const critical = claim_diffs.filter((d) => d.severity === 'CRITICAL').length;
  const score = Math.max(0, 100 - critical * 40 - claim_diffs.length * 8);
  return {
    passed: claim_diffs.length === 0,
    score,
    claim_diffs,
    side_effect_violations: [],
  };
}

export function evaluateSingleAssuranceRule(
  state: Record<string, unknown>,
  rule: AssuranceRule,
): AssuranceClaimDiff | null {
  return assuranceRuleToDiff(state, rule);
}
