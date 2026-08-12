import { ChangedFile, addedLinesFromPatch } from '@/lib/scanner/diff';

export type ScaSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface ScaPackageRef {
  name: string;
  version: string;
  ecosystem: 'npm';
}

export interface ScaFinding {
  packageName: string;
  version: string;
  cveId: string;
  severity: ScaSeverity;
  filename: string;
  line: number;
  summary: string;
}

const MANIFEST_PATTERNS = [
  /^package\.json$/i,
  /^package-lock\.json$/i,
  /^yarn\.lock$/i,
  /(?:^|\/)package\.json$/i,
  /(?:^|\/)package-lock\.json$/i,
  /(?:^|\/)yarn\.lock$/i,
];

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_BATCH_SIZE = 100;
const REPORTED_SEVERITIES = new Set<ScaSeverity>(['CRITICAL', 'HIGH', 'MEDIUM']);

interface OsvBatchQuery {
  package: { name: string; ecosystem: string };
  version: string;
}

interface OsvVulnerability {
  id: string;
  summary?: string;
  database_specific?: { severity?: string };
  severity?: Array<{ type?: string; score?: string }>;
}

interface OsvBatchResult {
  vulns?: OsvVulnerability[];
}

export function isScaManifestFile(filename: string): boolean {
  return MANIFEST_PATTERNS.some((pattern) => pattern.test(filename));
}

export function getScaManifestFiles(files: ChangedFile[]): ChangedFile[] {
  return files.filter((file) => isScaManifestFile(file.filename));
}

function normalizeVersion(version: string): string {
  return version.replace(/^[\^~>=<]+/, '').trim();
}

function lineNumberForKey(content: string, key: string): number {
  const lines = content.split('\n');
  const pattern = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`);
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return 1;
}

function severityFromVuln(vuln: OsvVulnerability): ScaSeverity | null {
  const dbSeverity = vuln.database_specific?.severity?.toUpperCase();
  if (dbSeverity === 'CRITICAL' || dbSeverity === 'HIGH' || dbSeverity === 'MEDIUM') {
    return dbSeverity;
  }

  for (const entry of vuln.severity ?? []) {
    const score = Number(entry.score);
    if (!Number.isFinite(score)) continue;
    if (score >= 9) return 'CRITICAL';
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
  }

  if (vuln.id.startsWith('GHSA-') || vuln.id.startsWith('CVE-')) {
    return 'MEDIUM';
  }

  return null;
}

function dependencyEntriesFromPatch(patch: string): ScaPackageRef[] {
  const added = addedLinesFromPatch(patch);
  const packages: ScaPackageRef[] = [];
  const skipKeys = new Set([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'name',
    'version',
    'scripts',
    'engines',
  ]);
  const depLine = new RegExp(
    '"((?:@[^"/]+/[^"/]+)|[^"/]+)":\\s*"([^"]+)"',
    'g',
  );
  let match: RegExpExecArray | null;

  while ((match = depLine.exec(added)) !== null) {
    const [, name, version] = match;
    if (!name || !version || skipKeys.has(name)) continue;
    packages.push({ name, version: normalizeVersion(version), ecosystem: 'npm' });
  }

  return packages;
}

export function parsePackageJson(content: string): ScaPackageRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const manifest = parsed as Record<string, unknown>;
  const sections = ['dependencies', 'devDependencies'] as const;
  const packages: ScaPackageRef[] = [];

  for (const section of sections) {
    const deps = manifest[section];
    if (!deps || typeof deps !== 'object') continue;

    for (const [name, versionValue] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof versionValue !== 'string') continue;
      packages.push({ name, version: normalizeVersion(versionValue), ecosystem: 'npm' });
    }
  }

  return packages;
}

export function parsePackageLockJson(content: string): ScaPackageRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const lock = parsed as { packages?: Record<string, { version?: string }> };
  const packages: ScaPackageRef[] = [];
  const seen = new Set<string>();

  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (!meta?.version || pkgPath === '') continue;
    const name = pkgPath.startsWith('node_modules/') ? pkgPath.replace(/^node_modules\//, '') : pkgPath;
    const dedupeKey = `${name}@${meta.version}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    packages.push({ name, version: meta.version, ecosystem: 'npm' });
  }

  return packages;
}

export function parseYarnLock(content: string): ScaPackageRef[] {
  const packages: ScaPackageRef[] = [];
  const seen = new Set<string>();

  for (const block of content.split('\n\n')) {
    const header = block.split('\n')[0]?.trim();
    if (!header || header.startsWith('#')) continue;

    const versionMatch = /version\s+"([^"]+)"/.exec(block);
    if (!versionMatch) continue;

    let name = header.replace(/:$/, '').replace(/^"/, '').replace(/"$/, '');
    if (name.startsWith('@')) {
      const atIndex = name.lastIndexOf('@');
      if (atIndex > 0) name = name.slice(0, atIndex);
    } else {
      const atIndex = name.indexOf('@');
      if (atIndex > 0) name = name.slice(0, atIndex);
    }

    const dedupeKey = `${name}@${versionMatch[1]}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    packages.push({ name, version: versionMatch[1], ecosystem: 'npm' });
  }

  return packages;
}

function parseManifestContent(filename: string, content: string, patch?: string): ScaPackageRef[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('package.json')) {
    return parsePackageJson(content);
  }
  if (lower.endsWith('package-lock.json')) {
    const fromLock = parsePackageLockJson(content);
    if (fromLock.length > 0) return fromLock;
  }
  if (lower.endsWith('yarn.lock')) {
    const fromYarn = parseYarnLock(content);
    if (fromYarn.length > 0) return fromYarn;
  }

  if (patch) {
    return dependencyEntriesFromPatch(patch);
  }

  return [];
}

function dedupePackages(packages: ScaPackageRef[]): ScaPackageRef[] {
  const map = new Map<string, ScaPackageRef>();
  for (const pkg of packages) {
    map.set(`${pkg.name}@${pkg.version}`, pkg);
  }
  return Array.from(map.values());
}

async function queryOsvBatch(packages: ScaPackageRef[]): Promise<Map<string, OsvVulnerability[]>> {
  const results = new Map<string, OsvVulnerability[]>();
  if (packages.length === 0) return results;

  for (let i = 0; i < packages.length; i += OSV_BATCH_SIZE) {
    const chunk = packages.slice(i, i + OSV_BATCH_SIZE);
    const queries: OsvBatchQuery[] = chunk.map((pkg) => ({
      package: { name: pkg.name, ecosystem: pkg.ecosystem },
      version: pkg.version,
    }));

    const response = await fetch(OSV_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });

    if (!response.ok) {
      console.error('[sca] OSV querybatch failed:', response.status, await response.text());
      continue;
    }

    const body = (await response.json()) as { results?: OsvBatchResult[] };
    for (let j = 0; j < chunk.length; j += 1) {
      const pkg = chunk[j];
      const key = `${pkg.name}@${pkg.version}`;
      results.set(key, body.results?.[j]?.vulns ?? []);
    }
  }

  return results;
}

export function scaFindingType(cveId: string): string {
  return `SCA Vulnerability (${cveId})`;
}

export async function scanScaManifests(
  manifests: Array<{ filename: string; content: string; patch?: string }>,
): Promise<ScaFinding[]> {
  const findings: ScaFinding[] = [];

  for (const manifest of manifests) {
    const packages = dedupePackages(parseManifestContent(manifest.filename, manifest.content, manifest.patch));
    if (packages.length === 0) continue;

    const vulnMap = await queryOsvBatch(packages);

    for (const pkg of packages) {
      const vulns = vulnMap.get(`${pkg.name}@${pkg.version}`) ?? [];
      const line = lineNumberForKey(manifest.content, pkg.name);

      for (const vuln of vulns) {
        const severity = severityFromVuln(vuln);
        if (!severity || !REPORTED_SEVERITIES.has(severity)) continue;

        findings.push({
          packageName: pkg.name,
          version: pkg.version,
          cveId: vuln.id,
          severity,
          filename: manifest.filename,
          line,
          summary: vuln.summary ?? `${pkg.name}@${pkg.version} has a known vulnerability`,
        });
      }
    }
  }

  return findings.sort((a, b) => a.filename.localeCompare(b.filename) || a.line - b.line);
}

export async function scanScaForChangedFiles(
  changedFiles: ChangedFile[],
  fetchContent: (filename: string) => Promise<string | null>,
): Promise<ScaFinding[]> {
  const manifestFiles = getScaManifestFiles(changedFiles);
  if (manifestFiles.length === 0) {
    return [];
  }

  const manifests: Array<{ filename: string; content: string; patch?: string }> = [];

  for (const file of manifestFiles) {
    const content = await fetchContent(file.filename);
    if (!content) continue;
    manifests.push({ filename: file.filename, content, patch: file.patch });
  }

  return scanScaManifests(manifests);
}
