import type { ProofCenterMetrics, ProofCenterRunResult } from '@/types/proof-center';

export async function fetchProofCenterMetrics(): Promise<ProofCenterMetrics> {
  const response = await fetch('/api/proof-center', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Proof Center metrics unavailable (${response.status})`);
  }
  return response.json() as Promise<ProofCenterMetrics>;
}

export async function runProofCenterBenchmark(): Promise<ProofCenterRunResult> {
  const response = await fetch('/api/proof-center/run', {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Proof Center benchmark failed (${response.status})`);
  }
  return response.json() as Promise<ProofCenterRunResult>;
}
