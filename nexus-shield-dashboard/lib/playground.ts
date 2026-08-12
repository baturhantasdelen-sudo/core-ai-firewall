export const PLAYGROUND_FREE_SCAN_LIMIT = 50;
export const PLAYGROUND_SCANS_STORAGE_KEY = 'nexus_playground_scans_used';

export function getPlaygroundScansUsed(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(PLAYGROUND_SCANS_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function incrementPlaygroundScansUsed(): number {
  const next = getPlaygroundScansUsed() + 1;
  window.localStorage.setItem(PLAYGROUND_SCANS_STORAGE_KEY, String(next));
  return next;
}

export function getPlaygroundScansRemaining(): number {
  return Math.max(0, PLAYGROUND_FREE_SCAN_LIMIT - getPlaygroundScansUsed());
}
