import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  ACTION_CONTROL_SIMULATOR_SCENARIO_IDS,
  ACTION_CONTROL_SIMULATOR_SCENARIOS,
} from '../lib/landing/action-control-simulator-data.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentPath = join(__dirname, '../components/landing/ActionControlSimulator.tsx');

describe('ActionControlSimulator landing data & component', () => {
  it('defines exactly three governance scenarios', () => {
    assert.equal(ACTION_CONTROL_SIMULATOR_SCENARIOS.length, 3);
    assert.deepEqual(ACTION_CONTROL_SIMULATOR_SCENARIO_IDS, [
      'verified',
      'policy-block',
      'outcome-mismatch',
    ]);
  });

  it('covers verified, blocked, and discrepancy outcome badges', () => {
    const tones = ACTION_CONTROL_SIMULATOR_SCENARIOS.map((s) => s.outcomeBadge.tone);
    assert.deepEqual(tones.sort(), ['blocked', 'discrepancy', 'verified']);
    for (const scenario of ACTION_CONTROL_SIMULATOR_SCENARIOS) {
      assert.ok(scenario.steps.length >= 4, `${scenario.id} should show full flow`);
      assert.ok(scenario.headline.length > 0);
    }
  });

  it('exports ActionControlSimulator with data-demo hook for smoke checks', () => {
    const source = readFileSync(componentPath, 'utf8');
    assert.match(source, /export function ActionControlSimulator/);
    assert.match(source, /data-demo="action-control-simulator"/);
    assert.match(source, /#0075de/);
    assert.match(source, /duration-200/);
  });
});
