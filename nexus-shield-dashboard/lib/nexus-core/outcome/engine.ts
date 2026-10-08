import type {
  ActualOutcome,
  ConstraintGroup,
  ConstraintOperator,
  ConstraintRule,
  DiffSeverity,
  ExpectedOutcome,
  OutcomeDiff,
} from '@/lib/nexus-core/outcome/models';

function isGroup(rule: ConstraintRule | ConstraintGroup): rule is ConstraintGroup {
  return 'logic' in rule && 'rules' in rule;
}

function getFieldValue(state: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function numericSeverity(field: string, expected: unknown, actual: unknown): DiffSeverity {
  if (/amount|total|value|balance|payment/.test(field.toLowerCase())) {
    const e = Number(expected);
    const a = Number(actual);
    if (!Number.isNaN(e) && !Number.isNaN(a)) {
      const ratio = Math.abs(e - a) / Math.max(Math.abs(e), 1);
      if (ratio >= 0.5 || Math.abs(e - a) >= 10000) return 'CRITICAL';
      if (ratio >= 0.1) return 'HIGH';
    }
  }
  if (/status|deleted|paid|posted|ledger/.test(field.toLowerCase())) return 'HIGH';
  return 'MEDIUM';
}

export function evaluateOperator(
  operator: ConstraintOperator,
  actual: unknown,
  expectedValue?: unknown,
): boolean {
  switch (operator) {
    case 'EQUALS':
      return actual === expectedValue || String(actual) === String(expectedValue);
    case 'NOT_EQUALS':
      return actual !== expectedValue && String(actual) !== String(expectedValue);
    case 'GREATER_THAN':
      return Number(actual) > Number(expectedValue);
    case 'LESS_THAN':
      return Number(actual) < Number(expectedValue);
    case 'GREATER_OR_EQUAL':
      return Number(actual) >= Number(expectedValue);
    case 'LESS_OR_EQUAL':
      return Number(actual) <= Number(expectedValue);
    case 'IN':
      return Array.isArray(expectedValue) && expectedValue.includes(actual);
    case 'NOT_IN':
      return Array.isArray(expectedValue) && !expectedValue.includes(actual);
    case 'CONTAINS':
      return String(actual).includes(String(expectedValue));
    case 'MATCHES':
      return new RegExp(String(expectedValue)).test(String(actual));
    case 'EXISTS':
      return actual !== undefined && actual !== null;
    case 'NOT_EXISTS':
      return actual === undefined || actual === null;
    default:
      return false;
  }
}

function evaluateRule(state: Record<string, unknown>, rule: ConstraintRule): OutcomeDiff | null {
  const actual = getFieldValue(state, rule.field);
  const ok = evaluateOperator(rule.operator, actual, rule.value);
  if (ok) return null;
  const severity = numericSeverity(rule.field, rule.value, actual);
  return {
    field: rule.field,
    expected: rule.value,
    actual,
    difference: `${rule.field} ${rule.operator} failed`,
    severity,
  };
}

function evaluateGroupInternal(
  state: Record<string, unknown>,
  group: ConstraintGroup,
): { passed: boolean; diffs: OutcomeDiff[] } {
  if (group.logic === 'ALL') {
    const diffs: OutcomeDiff[] = [];
    for (const rule of group.rules) {
      if (isGroup(rule)) {
        const nested = evaluateGroupInternal(state, rule);
        if (!nested.passed) diffs.push(...nested.diffs);
      } else {
        const diff = evaluateRule(state, rule);
        if (diff) diffs.push(diff);
      }
    }
    return { passed: diffs.length === 0, diffs };
  }

  const failing: OutcomeDiff[] = [];
  let anyPass = false;
  for (const rule of group.rules) {
    if (isGroup(rule)) {
      const nested = evaluateGroupInternal(state, rule);
      if (nested.passed) anyPass = true;
      else failing.push(...nested.diffs);
    } else {
      const diff = evaluateRule(state, rule);
      if (!diff) anyPass = true;
      else failing.push(diff);
    }
  }
  return { passed: anyPass, diffs: anyPass ? [] : failing };
}

export function evaluateConstraintGroup(
  state: Record<string, unknown>,
  group: ConstraintGroup,
): OutcomeDiff[] {
  return evaluateGroupInternal(state, group).diffs;
}

export function compareExpectedVsActual(
  expected: ExpectedOutcome,
  actual: ActualOutcome,
): { diffs: OutcomeDiff[]; score: number } {
  const state = actual.observed_state;
  let diffs: OutcomeDiff[] = [];

  for (const [key, value] of Object.entries(expected.expected_state)) {
    const actualVal = getFieldValue(state, key) ?? state[key];
    if (actualVal !== value && String(actualVal) !== String(value)) {
      diffs.push({
        field: key,
        expected: value,
        actual: actualVal,
        difference: `expected ${key}=${String(value)} got ${String(actualVal)}`,
        severity: numericSeverity(key, value, actualVal),
      });
    }
  }

  if (expected.constraints) {
    diffs = [...diffs, ...evaluateConstraintGroup(state, expected.constraints)];
  }

  const critical = diffs.filter((d) => d.severity === 'CRITICAL').length;
  const high = diffs.filter((d) => d.severity === 'HIGH').length;
  const score = Math.max(0, 100 - critical * 40 - high * 20 - diffs.length * 5);
  return { diffs, score };
}

export function defaultConstraintsFromExpectedState(
  expected_state: Record<string, unknown>,
): ConstraintGroup {
  const rules: ConstraintRule[] = Object.entries(expected_state).map(([field, value]) => ({
    field,
    operator: 'EQUALS' as const,
    value,
  }));
  return { logic: 'ALL', rules };
}
