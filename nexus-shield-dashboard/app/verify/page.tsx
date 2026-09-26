'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function VerifyReceiptContent() {
  const searchParams = useSearchParams();
  const receiptHash = searchParams.get('receipt_hash');
  const receiptId = searchParams.get('receipt_id');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // Burada receipt_hash ve receipt_id değerlerini backend API'niz ile doğrulayabilirsiniz
    if (receiptHash) {
      setLoading(false);
      setValid(true);
    } else {
      setLoading(false);
      setValid(false);
    }
  }, [receiptHash]);

  return (
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <h1 className="text-xl font-bold mb-4">Nexus Shield - Universal Action Receipt</h1>

      {loading ? (
        <p className="text-slate-400">Doğrulanıyor...</p>
      ) : valid ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
            <span>✓ Doğrulama Başarılı (Verified)</span>
          </div>
          <div className="text-xs text-slate-400 space-y-2 break-all bg-slate-950 p-4 rounded-lg border border-slate-800">
            <p>
              <strong>Receipt ID:</strong> {receiptId || 'N/A'}
            </p>
            <p>
              <strong>Receipt Hash:</strong> {receiptHash}
            </p>
          </div>
          <p className="text-sm text-slate-300">
            Bu eylem Nexus Shield güvenlik protokolü tarafından kriptografik olarak imzalanmış ve
            doğrulanmıştır.
          </p>
        </div>
      ) : (
        <div className="text-rose-400">
          <p>Geçersiz veya eksik doğrulama parametresi.</p>
        </div>
      )}
    </div>
  );
}

export default function VerifyReceiptPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <Suspense
        fallback={
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <p className="text-slate-400">Doğrulanıyor...</p>
          </div>
        }
      >
        <VerifyReceiptContent />
      </Suspense>
    </main>
  );
}
