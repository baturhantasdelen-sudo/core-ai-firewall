const STATUSES = [
  {
    id: 'VERIFIED',
    title: 'VERIFIED',
    color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
    what: 'Expected action and authoritative evidence align on the expected outcome.',
    why: 'Multi-source reads and rules passed within constraints.',
    evidence: 'Payment provider, ERP, ledger hashes linked in proof.',
    next: 'Archive UAR 2.0 proof; optional SIEM export.',
  },
  {
    id: 'UNVERIFIED',
    title: 'UNVERIFIED',
    color: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    what: 'Action may have run; outcome cannot be established yet.',
    why: 'Missing ledger row, PENDING state, or insufficient evidence.',
    evidence: 'Partial reads; false-success pattern possible.',
    next: 'Poll authoritative sources; escalate if tool claimed success.',
  },
  {
    id: 'FAILED',
    title: 'FAILED',
    color: 'border-rose-500/30 bg-rose-500/5 text-rose-200',
    what: 'Actual outcome conflicts with expected outcome.',
    why: 'Field-level diff (e.g. amount, customer id, record count).',
    evidence: 'Outcome diff with severity; side-effect violations.',
    next: 'Containment, reversal workflow, human review.',
  },
  {
    id: 'BLOCKED',
    title: 'BLOCKED',
    color: 'border-violet-500/30 bg-violet-500/5 text-violet-200',
    what: 'Action prevented before or during execution.',
    why: 'Policy, authority, risk, or integrity constraint.',
    evidence: 'Decision record; post-block verification ensures no mutation.',
    next: 'Adjust policy or request approval; verify world unchanged.',
  },
] as const;

export function VerificationStatusCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {STATUSES.map((s) => (
        <article key={s.id} className={`rounded-xl border p-5 ${s.color}`}>
          <h3 className="text-sm font-bold tracking-wide">{s.title}</h3>
          <dl className="mt-3 space-y-2 text-xs text-zinc-400">
            <div>
              <dt className="font-semibold text-zinc-300">What happened?</dt>
              <dd>{s.what}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-300">Why this state?</dt>
              <dd>{s.why}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-300">Evidence</dt>
              <dd>{s.evidence}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-300">Operator action</dt>
              <dd>{s.next}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
