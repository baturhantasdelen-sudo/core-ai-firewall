export type TrajectoryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TrajectoryAction {
  toolName: string;
  timestamp: string;
  category?: string;
  args?: Record<string, unknown>;
}

export interface TrajectoryEvaluationResult {
  trajectoryRisk: TrajectoryRiskLevel;
  sequenceViolationDetected: boolean;
  unsafeSequenceReason: string;
  matchedPattern?: string;
  windowActions: TrajectoryAction[];
  riskScore: number;
}

const TRAJECTORY_WINDOW_MS = 30_000;

const trajectoryWindowStore = new Map<string, TrajectoryAction[]>();

const UNSAFE_SEQUENCES: Array<{
  pattern: string[];
  label: string;
  riskLevel: TrajectoryRiskLevel;
  reason: string;
  riskScore: number;
}> = [
  {
    pattern: ['read_db', 'call_api', 'write_file'],
    label: 'READ_DB → CALL_API → WRITE_FILE',
    riskLevel: 'CRITICAL',
    reason: 'Data exfiltration chain: database read followed by external API call and file write',
    riskScore: 92,
  },
  {
    pattern: ['read_db', 'api_call', 'write_file'],
    label: 'READ_DB → API_CALL → WRITE_FILE',
    riskLevel: 'CRITICAL',
    reason: 'Cross-boundary data staging: read from DB, relay via API, persist to filesystem',
    riskScore: 90,
  },
  {
    pattern: ['read', 'db_read', 'export'],
    label: 'READ → DB_READ → EXPORT',
    riskLevel: 'HIGH',
    reason: 'Progressive data harvesting ending in bulk export',
    riskScore: 78,
  },
  {
    pattern: ['read_db', 'external_upload'],
    label: 'READ_DB → EXTERNAL_UPLOAD',
    riskLevel: 'HIGH',
    reason: 'Direct database-to-external upload without declared export intent',
    riskScore: 75,
  },
  {
    pattern: ['call_api', 'write_db'],
    label: 'CALL_API → WRITE_DB',
    riskLevel: 'MEDIUM',
    reason: 'External data ingestion into database — potential poisoned write path',
    riskScore: 55,
  },
  {
    pattern: ['read_db', 'call_api'],
    label: 'READ_DB → CALL_API',
    riskLevel: 'MEDIUM',
    reason: 'Sensitive read followed by outbound API call within 30s window',
    riskScore: 48,
  },
];

function abstractActionCategory(toolName: string): string {
  const normalized = toolName.toLowerCase();

  if (/read_db|db_read|sql_query|query_database|postgres_query/.test(normalized)) return 'read_db';
  if (/write_file|save_file|file_write|write_to_disk/.test(normalized)) return 'write_file';
  if (/write_db|insert_db|update_db|db_write/.test(normalized)) return 'write_db';
  if (/call_api|api_call|http_request|fetch_url|rest_api/.test(normalized)) return 'call_api';
  if (/external_upload|upload_external|send_to_webhook|webhook_post/.test(normalized)) {
    return 'external_upload';
  }
  if (/bulk_export|export_db|dump_db|export_csv|sql_export/.test(normalized)) return 'export';
  if (/^read_|_read$|fetch_|get_/.test(normalized) || /read_file|load_file/.test(normalized)) {
    return 'read';
  }
  if (/db_|database|sql/.test(normalized)) return 'db_read';
  if (/api_|http_/.test(normalized)) return 'api_call';

  return normalized.replace(/[^a-z0-9_]/g, '_').slice(0, 24);
}

function resolveRiskLevel(score: number): TrajectoryRiskLevel {
  if (score >= 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

function withinWindow(timestamp: string, nowMs: number): boolean {
  const actionMs = new Date(timestamp).getTime();
  return nowMs - actionMs <= TRAJECTORY_WINDOW_MS;
}

function filterWindowActions(actions: TrajectoryAction[], nowMs = Date.now()): TrajectoryAction[] {
  return actions.filter((action) => withinWindow(action.timestamp, nowMs));
}

function matchesSequence(categories: string[], pattern: string[]): boolean {
  if (categories.length < pattern.length) return false;
  const window = categories.slice(-pattern.length);
  return window.every((category, index) => category === pattern[index]);
}

function enrichAction(action: TrajectoryAction): TrajectoryAction {
  return {
    ...action,
    category: action.category ?? abstractActionCategory(action.toolName),
  };
}

export function recordTrajectoryAction(agentId: string, action: TrajectoryAction): TrajectoryAction[] {
  const enriched = enrichAction(action);
  const existing = trajectoryWindowStore.get(agentId) ?? [];
  const pruned = filterWindowActions(existing);
  const updated = [...pruned, enriched];
  trajectoryWindowStore.set(agentId, updated);
  return updated;
}

export function getTrajectoryWindow(agentId: string): TrajectoryAction[] {
  return filterWindowActions(trajectoryWindowStore.get(agentId) ?? []);
}

export function evaluateTrajectory(
  agentId: string,
  actionSequence: TrajectoryAction[],
): TrajectoryEvaluationResult {
  const nowMs = Date.now();
  const stored = getTrajectoryWindow(agentId);
  const incoming = actionSequence.map(enrichAction);
  const merged = [...stored, ...incoming];
  const windowActions = filterWindowActions(merged, nowMs);
  const categories = windowActions.map((action) => action.category!);

  for (const sequence of UNSAFE_SEQUENCES) {
    if (matchesSequence(categories, sequence.pattern)) {
      return {
        trajectoryRisk: sequence.riskLevel,
        sequenceViolationDetected: true,
        unsafeSequenceReason: sequence.reason,
        matchedPattern: sequence.label,
        windowActions,
        riskScore: sequence.riskScore,
      };
    }
  }

  const uniqueCategories = new Set(categories);
  let riskScore = 0;
  if (uniqueCategories.has('read_db') && uniqueCategories.has('call_api')) riskScore += 25;
  if (uniqueCategories.has('read_db') && uniqueCategories.has('write_file')) riskScore += 30;
  if (uniqueCategories.size >= 4) riskScore += 15;

  const trajectoryRisk = resolveRiskLevel(riskScore);

  return {
    trajectoryRisk,
    sequenceViolationDetected: false,
    unsafeSequenceReason: '',
    windowActions,
    riskScore,
  };
}

export function resetTrajectoryEngine(agentId?: string): void {
  if (agentId) {
    trajectoryWindowStore.delete(agentId);
    return;
  }
  trajectoryWindowStore.clear();
}
