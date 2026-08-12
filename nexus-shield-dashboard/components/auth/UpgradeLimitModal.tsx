'use client';

import Link from 'next/link';

interface UpgradeLimitModalProps {
  open: boolean;
  onClose: () => void;
  used: number;
  limit: number;
}

export function UpgradeLimitModal({ open, onClose, used, limit }: UpgradeLimitModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-zinc-100">Free scan limit reached</h3>
        <p className="mt-2 text-sm text-zinc-400">
          You&apos;ve used {used} of {limit} free scans this month. Upgrade to Pro for production-grade limits
          and unlimited playground access.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/#pricing"
            onClick={onClose}
            className="inline-flex flex-1 select-none cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Upgrade to Pro — $59/mo
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="select-none cursor-pointer rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>{' '}
          to sync usage across devices.
        </p>
      </div>
    </div>
  );
}
