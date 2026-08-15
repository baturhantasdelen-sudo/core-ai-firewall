'use client';

import { useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { NEXUS_CONTACT_EMAIL, NEXUS_CONTACT_MAILTO } from '@/lib/contact';

interface ContactEmailProps {
  variant?: 'section' | 'footer';
  className?: string;
}

export function ContactEmail({ variant = 'section', className = '' }: ContactEmailProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(NEXUS_CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail in unsupported/insecure contexts.
    }
  }

  const isFooter = variant === 'footer';

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <a
        href={NEXUS_CONTACT_MAILTO}
        className={`group inline-flex items-center gap-2 transition-colors ${
          isFooter
            ? 'text-zinc-500 hover:text-zinc-300'
            : 'rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-zinc-200 hover:border-emerald-500/30 hover:text-emerald-300'
        }`}
      >
        <Mail
          className={`shrink-0 ${isFooter ? 'h-3.5 w-3.5' : 'h-4 w-4 text-emerald-400'}`}
          aria-hidden
        />
        <span className={isFooter ? 'text-xs' : 'text-sm font-medium'}>{NEXUS_CONTACT_EMAIL}</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="E-posta adresini kopyala"
        className={`shrink-0 rounded-md transition-colors ${
          isFooter
            ? 'p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            : 'border border-white/10 bg-zinc-900/80 p-2 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
        }`}
      >
        {copied ? (
          <Check className={`${isFooter ? 'h-3.5 w-3.5 text-emerald-400' : 'h-4 w-4 text-emerald-400'}`} />
        ) : (
          <Copy className={isFooter ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        )}
      </button>

      {copied ? (
        <span
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-lg shadow-emerald-500/10 ${
            isFooter ? '-top-9 left-1/2 -translate-x-1/2' : '-top-10 left-1/2 -translate-x-1/2'
          }`}
        >
          Adres kopyalandı
        </span>
      ) : null}
    </div>
  );
}
