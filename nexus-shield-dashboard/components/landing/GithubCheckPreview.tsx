import { AlertTriangle, GitPullRequest, ShieldAlert, XCircle } from 'lucide-react';

const CODE_LINES = [
  { n: 21, code: "  APP_NAME = 'nexus-shield-demo-service'", flagged: false },
  { n: 22, code: '  DEBUG = os.getenv("DEBUG", "false")', flagged: false },
  { n: 23, code: '  AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"', flagged: true },
  { n: 24, code: '  AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI..."', flagged: true },
  { n: 25, code: '  OPENAI_API_KEY = "sk-proj-abc123..."', flagged: true },
];

/**
 * A static, stylized mock of the real GitHub Check Run + inline annotation
 * experience Nexus Shield produces on a PR (see
 * `lib/services/github-scanner.ts` / `lib/github/checks.ts`) — used purely
 * for marketing purposes on the landing page.
 */
export function GithubCheckPreview() {
  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-950/60 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <GitPullRequest className="h-3.5 w-3.5" />
          nexus-shield-test-repo · PR #1
        </span>
      </div>

      {/* Check run status */}
      <div className="flex items-center justify-between border-b border-white/10 bg-rose-500/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <XCircle className="h-4.5 w-4.5 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-zinc-100">Nexus Shield Security Gatekeeper</p>
            <p className="text-xs text-zinc-500">3 potential leaks detected · 0.8s</p>
          </div>
        </div>
        <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400">
          Failing
        </span>
      </div>

      {/* Code diff */}
      <div className="bg-zinc-950/80 px-0 py-2 font-mono text-[13px]">
        {CODE_LINES.map((line) => (
          <div key={line.n}>
            <div
              className={`flex items-start gap-3 px-4 py-1 ${
                line.flagged ? 'bg-rose-500/[0.08]' : ''
              }`}
            >
              <span className="w-4 shrink-0 select-none text-right text-zinc-600">{line.n}</span>
              <code className={line.flagged ? 'text-rose-300' : 'text-zinc-400'}>{line.code}</code>
            </div>
            {line.flagged ? (
              <div className="mx-4 mb-1.5 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs leading-snug text-rose-300">
                  <span className="font-semibold">
                    {line.n === 23 ? 'AWS Access Key' : line.n === 24 ? 'High-Entropy Secret' : 'OpenAI API Key'}
                  </span>{' '}
                  detected — rotate this credential immediately.
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500">
        <ShieldAlert className="h-3.5 w-3.5 text-zinc-600" />
        Detected &amp; blocked before merge — zero source code left your pipeline.
      </div>
    </div>
  );
}
