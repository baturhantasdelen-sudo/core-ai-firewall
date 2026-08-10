'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface SetupGuideModalProps {
  apiKey: string;
  onClose: () => void;
}

export function SetupGuideModal({ apiKey, onClose }: SetupGuideModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const workflowSnippet = `- name: Run Nexus Shield Gatekeeper
  uses: baturhantasdelen-sudo/nexus-shield-action@v1
  with:
    github-token: \${{ github.token }}
    nexus-api-key: \${{ secrets.NEXUS_API_KEY }}
    fail-on-detection: true`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">GitHub Action Setup</h2>
            <p className="mt-1 text-sm text-zinc-500">Two steps to enable Nexus Shield telemetry.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-400">
                1
              </span>
              <p className="text-sm font-medium text-zinc-200">
                Add <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-300">NEXUS_API_KEY</code> as a repository secret
              </p>
            </div>
            <p className="mt-2 ml-8 text-sm text-zinc-500">
              Repository → Settings → Secrets and variables → Actions → New repository secret
            </p>
            <pre className="mt-2 ml-8 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
              {apiKey}
            </pre>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-400">
                2
              </span>
              <p className="text-sm font-medium text-zinc-200">
                Reference it in <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-300">.github/workflows/nexus-shield.yml</code>
              </p>
            </div>
            <pre className="mt-2 ml-8 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300">
              {workflowSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
