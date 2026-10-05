/** Tripartite outcome states for landing deception demos. */

export type TripartiteState = 'VERIFIED' | 'BLOCKED' | 'UNVERIFIED';

export interface TripartiteMeta {
  state: TripartiteState;
  title: string;
  description: string;
  ghostAction: boolean;
  border: string;
  bg: string;
  text: string;
  glow: string;
}

export const TRIPARTITE_LEGEND: TripartiteMeta[] = [
  {
    state: 'VERIFIED',
    title: 'Verified',
    description: 'Tool outcome matches business ledger and authoritative state.',
    ghostAction: false,
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-200',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.2)]',
  },
  {
    state: 'BLOCKED',
    title: 'Blocked',
    description: 'Policy violation or intent divergence caught before execution.',
    ghostAction: false,
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    text: 'text-rose-200',
    glow: 'shadow-[0_0_24px_rgba(244,63,94,0.18)]',
  },
  {
    state: 'UNVERIFIED',
    title: 'Unverified · Ghost Action',
    description: 'Agent reports HTTP 200 OK, but ledger/state cross-check finds no mutation (false success).',
    ghostAction: true,
    border: 'border-amber-500/45',
    bg: 'bg-amber-500/10',
    text: 'text-amber-200',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.22)]',
  },
];

export function getTripartiteMeta(state: TripartiteState): TripartiteMeta {
  return TRIPARTITE_LEGEND.find((item) => item.state === state) ?? TRIPARTITE_LEGEND[0]!;
}
