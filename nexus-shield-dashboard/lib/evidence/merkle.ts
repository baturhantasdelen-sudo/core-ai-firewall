import type { EvidenceBundle, EvidenceMerkleTree, MerkleProof, MerkleProofStep } from '@/lib/evidence/types';
import { hashBundleLeaf, sha256 } from '@/lib/evidence/generator';

function hashPair(left: string, right: string): string {
  return sha256(`${left}${right}`);
}

function buildLayers(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];

  const layers: string[][] = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]!;
      const right = current[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

/**
 * Builds an immutable Merkle tree over evidence bundle leaf hashes.
 */
export function buildEvidenceMerkleTree(bundles: EvidenceBundle[]): EvidenceMerkleTree {
  const leaves = bundles.map((bundle) => hashBundleLeaf(bundle));
  const layers = buildLayers(leaves);
  const rootHash = layers[layers.length - 1]?.[0] ?? sha256('empty-evidence-tree');

  return {
    rootHash,
    leafCount: leaves.length,
    leaves,
    layers,
    builtAt: new Date().toISOString(),
  };
}

function buildProofForIndex(layers: string[][], leafIndex: number): MerkleProofStep[] {
  const steps: MerkleProofStep[] = [];
  let index = leafIndex;

  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level]!;
    const isRight = index % 2 === 0;
    const siblingIndex = isRight ? index + 1 : index - 1;
    const sibling = layer[siblingIndex] ?? layer[index]!;

    steps.push({
      hash: sibling,
      position: isRight ? 'right' : 'left',
    });

    index = Math.floor(index / 2);
  }

  return steps;
}

export function generateMerkleProof(
  tree: EvidenceMerkleTree,
  bundle: EvidenceBundle,
): MerkleProof | null {
  const leafHash = hashBundleLeaf(bundle);
  const leafIndex = tree.leaves.indexOf(leafHash);
  if (leafIndex < 0) return null;

  return {
    leafHash,
    rootHash: tree.rootHash,
    steps: buildProofForIndex(tree.layers, leafIndex),
    bundleId: bundle.bundleId,
  };
}

/**
 * Verifies a Merkle inclusion proof for an evidence bundle against the tree root.
 */
export function verifyEvidenceProof(proof: MerkleProof): boolean {
  let computed = proof.leafHash;

  for (const step of proof.steps) {
    computed =
      step.position === 'right'
        ? hashPair(computed, step.hash)
        : hashPair(step.hash, computed);
  }

  return computed === proof.rootHash;
}

export function verifyBundleInTree(
  bundle: EvidenceBundle,
  tree: EvidenceMerkleTree,
): { valid: boolean; proof: MerkleProof | null } {
  const proof = generateMerkleProof(tree, bundle);
  if (!proof) return { valid: false, proof: null };
  return { valid: verifyEvidenceProof(proof), proof };
}
