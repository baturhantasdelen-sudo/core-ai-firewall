import type { OutcomeVerifyRequest } from '@/lib/nexus-core/outcome/models';
import type { RecordProvenance } from '@/lib/nexus-core/assurance-persistence/types';

/** Server-side provenance — never trust client-supplied record_type. */
export function deriveRecordProvenance(
  req: OutcomeVerifyRequest,
  options?: { force_demo?: boolean },
): RecordProvenance {
  if (options?.force_demo) return 'DEMO';
  if (req.adapter_id === 'mock' || req.mock_fixture) return 'DEMO';
  if (req.adapter_id === 'finance_erp_http' || req.adapter_id === 'generic_http' || req.adapter_id === 'database') {
    return 'REAL';
  }
  if (req.observed_state_override && !req.mock_fixture) return 'DEMO';
  return 'REAL';
}

export function classifyStoredProvenance(stored: RecordProvenance | undefined): RecordProvenance {
  return stored ?? 'UNKNOWN';
}
