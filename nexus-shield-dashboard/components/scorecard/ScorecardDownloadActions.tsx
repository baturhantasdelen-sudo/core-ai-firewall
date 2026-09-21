'use client';

import { Download, FileText } from 'lucide-react';
import { SCORECARD_EXECUTIVE_MD_PATH } from '@/lib/scorecard/scorecard-data';

export function ScorecardDownloadActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href={SCORECARD_EXECUTIVE_MD_PATH}
        download
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:scale-[1.02]"
      >
        <Download className="h-4 w-4" />
        Download CISO Executive Summary (MD)
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-200 backdrop-blur-md transition hover:bg-white/10"
      >
        <FileText className="h-4 w-4" />
        Save as PDF (Print)
      </button>
    </div>
  );
}
