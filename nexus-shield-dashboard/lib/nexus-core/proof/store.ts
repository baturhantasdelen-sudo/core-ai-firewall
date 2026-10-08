import type { TransactionProofBundle } from '@/lib/nexus-core/proof/types';
import { assembleTransactionProof } from '@/lib/nexus-core/proof/assemble';
import type { Uar20Receipt } from '@/lib/nexus-core/uar/models';

const proofByTransaction = new Map<string, TransactionProofBundle>();

export function persistUar20Proof(receipt: Uar20Receipt): TransactionProofBundle {
  const bundle = assembleTransactionProof(receipt);
  proofByTransaction.set(bundle.transaction_id, bundle);
  return bundle;
}

export function getProofByTransactionId(transaction_id: string): TransactionProofBundle | undefined {
  return proofByTransaction.get(transaction_id);
}

export function clearProofStoreForTests(): void {
  proofByTransaction.clear();
}
