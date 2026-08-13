import type { Profile, ScanMatch } from './types';

interface RemoteScanResponse {
  findings?: Array<{
    type: string;
    rule_id?: string;
    line?: number;
    preview?: string;
    category?: string;
  }>;
}

export async function scanContentRemote(params: {
  content: string;
  filename: string;
  profile: Profile;
  apiUrl: string;
  apiKey: string;
}): Promise<ScanMatch[]> {
  const { content, filename, profile, apiUrl, apiKey } = params;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      repo_name: 'vscode/workspace',
      commit_sha: 'workspace',
      policy: { profile },
      files: [{ path: filename, content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Remote scan failed (${response.status})`);
  }

  const payload = (await response.json()) as RemoteScanResponse;
  const findings = payload.findings ?? [];

  return findings.map((finding, index) => {
    const line = finding.line ?? 1;
    const lines = content.split('\n');
    const lineText = lines[line - 1] ?? content;
    const matched = finding.preview ?? lineText.trim();

    let rangeStart = 0;
    for (let i = 0; i < line - 1; i += 1) {
      rangeStart += lines[i].length + 1;
    }
    const columnIndex = Math.max(0, lineText.indexOf(matched.slice(0, 8)));
    rangeStart += columnIndex;

    return {
      ruleId: finding.rule_id ?? `remote-${index}`,
      type: finding.type,
      line,
      column: columnIndex + 1,
      matched: matched.length > 80 ? matched.slice(0, 80) : matched,
      category: finding.category === 'pii' ? 'pii' : 'secret',
      rangeStart,
      rangeEnd: rangeStart + matched.length,
    } satisfies ScanMatch;
  });
}
