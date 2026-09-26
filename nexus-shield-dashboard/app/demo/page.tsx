import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { IndependentVerificationShowcase } from '@/components/demo/IndependentVerificationShowcase';

export const metadata: Metadata = {
  title: 'Detect & Demonstrate | Nexus Shield',
  description:
    'Live FinTech attack simulation with Universal Action Receipts and independent /verify cryptographic proof.',
  openGraph: {
    title: 'Detect & Demonstrate — Independent Verification Demo',
    description:
      'Bul ve Göster: block agent exfiltration, seal SHA-256 evidence, verify on nexus-shield-dashboard.vercel.app/verify.',
    url: 'https://nexus-shield-dashboard.vercel.app/demo',
  },
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo size={32} />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/reports/state-of-agent-security-2026" className="hover:text-white">
              Report 2026
            </Link>
            <Link href="/verify" className="hover:text-white">
              Verify UAR
            </Link>
            <Link href="/proof-center" className="hover:text-white">
              Proof Center
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <IndependentVerificationShowcase />
      </main>
    </div>
  );
}
