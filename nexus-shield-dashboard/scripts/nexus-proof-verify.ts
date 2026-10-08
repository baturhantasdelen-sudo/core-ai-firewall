#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { verifyProofFileContents } from '@/lib/nexus-core/uar/verify';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/nexus-proof-verify.ts <proof.json>');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const result = verifyProofFileContents(raw);

console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
