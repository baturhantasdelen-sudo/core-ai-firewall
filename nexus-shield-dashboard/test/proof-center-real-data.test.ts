import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Proof Center real data integration', () => {
  it('VerificationProofLookup does not inject demo proof on error', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/proof-center/VerificationProofLookup.tsx'),
      'utf8',
    );
    assert.match(src, /no demo record is shown/);
    assert.doesNotMatch(src, /setProof\(.*DEMO.*fallback/i);
  });

  it('proof API rejects client record_type on verify route', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/v1/outcome/verify/route.ts'), 'utf8');
    assert.match(src, /record_type is server-derived/);
  });
});
