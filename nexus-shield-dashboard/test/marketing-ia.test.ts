import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  ASSURANCE_LINKS,
  DEVELOPERS_LINKS,
  PLATFORM_LINKS,
  SOLUTIONS_LINKS,
} from '@/lib/site-navigation';
import { NEXUS_MANIFESTO, NEXUS_PRODUCT_CATEGORY } from '@/lib/brand/copy-standards';

const ROOT = join(import.meta.dirname, '..');

function routeExists(href: string): boolean {
  const path = href.replace(/^\//, '');
  const page = join(ROOT, 'app', path, 'page.tsx');
  return existsSync(page);
}

describe('Marketing IA', () => {
  it('uses assurance platform category and manifesto', () => {
    assert.match(NEXUS_PRODUCT_CATEGORY, /Assurance Platform/i);
    assert.match(NEXUS_MANIFESTO, /Control what agents can do/i);
  });

  it('primary platform routes exist', () => {
    for (const link of PLATFORM_LINKS) {
      assert.ok(routeExists(link.href), link.href);
    }
  });

  it('solution routes exist', () => {
    for (const link of SOLUTIONS_LINKS) {
      assert.ok(routeExists(link.href), link.href);
    }
  });

  it('assurance and developer routes exist', () => {
    for (const link of [...ASSURANCE_LINKS, ...DEVELOPERS_LINKS]) {
      assert.ok(routeExists(link.href), link.href);
    }
  });

  it('assessment funnel route exists', () => {
    assert.ok(routeExists('/assessment'));
  });
});
