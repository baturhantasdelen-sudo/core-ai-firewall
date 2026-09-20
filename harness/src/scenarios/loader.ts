import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessScenario, ScenarioCatalog } from '../types.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadScenarioCatalog(catalogPath?: string): ScenarioCatalog {
  const path = catalogPath ?? join(packageRoot, 'scenarios', 'index.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as ScenarioCatalog;
}

export function loadScenarios(catalogPath?: string): HarnessScenario[] {
  return loadScenarioCatalog(catalogPath).scenarios;
}
