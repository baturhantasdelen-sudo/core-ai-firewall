import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { VerificationProofLookup } from '@/components/proof-center/VerificationProofLookup';

export default async function VerificationProofPage({
  params,
}: {
  params: Promise<{ verification_id: string }>;
}) {
  const { verification_id } = await params;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-50">Verification proof</h1>
        <p className="mt-2 text-sm text-zinc-400">Server-backed assurance record (requires API key).</p>
        <div className="mt-8">
          <VerificationProofLookup initialVerificationId={verification_id} />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
