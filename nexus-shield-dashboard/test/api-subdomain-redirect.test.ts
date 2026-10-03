import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  API_SUBDOMAIN_HOST,
  PRIMARY_SITE_URL,
  redirectUrlFromApiSubdomain,
} from '../lib/site.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('api.nexusshield.ai permanent redirect', () => {
  it('preserves path and query on apex redirect URL', () => {
    assert.equal(
      redirectUrlFromApiSubdomain('/docs/benchmark', '?utm=1'),
      `${PRIMARY_SITE_URL}/docs/benchmark?utm=1`,
    );
    assert.equal(redirectUrlFromApiSubdomain('/', ''), `${PRIMARY_SITE_URL}/`);
  });

  it('next.config and vercel.json declare host-based 301 rules', () => {
    const nextConfig = readFileSync(join(__dirname, '../next.config.ts'), 'utf8');
    const vercel = readFileSync(join(__dirname, '../vercel.json'), 'utf8');
    assert.match(nextConfig, new RegExp(API_SUBDOMAIN_HOST));
    assert.match(nextConfig, /permanent:\s*true/);
    assert.match(vercel, new RegExp(API_SUBDOMAIN_HOST));
    assert.match(vercel, /"permanent":\s*true/);
  });

  it('nginx gateway redirects api subdomain with request_uri', () => {
    const nginx = readFileSync(
      join(__dirname, '../../deploy/nginx/nexus-shield.conf'),
      'utf8',
    );
    assert.match(nginx, /server_name api\.nexusshield\.ai;/);
    assert.match(nginx, /return 301 https:\/\/nexusshield\.ai\$request_uri;/);
  });
});
