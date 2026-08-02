const VERCEL_API_URL = 'https://api.vercel.com';

export type VercelAccessTokenResponse = {
  access_token?: string;
  token_type?: string;
  installation_id?: string;
  user_id?: string;
  team_id?: string;
  error?: string;
  error_description?: string;
};

export type VercelProject = {
  id: string;
  name: string;
};

export type EnvTarget = 'production' | 'preview' | 'development';

export type NexusShieldEnvVar = {
  key: string;
  value: string;
  type: 'plain' | 'secret';
  target: EnvTarget[];
};

function teamQuery(teamId?: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function getAccessToken(code: string): Promise<VercelAccessTokenResponse> {
  const res = await fetch(`${VERCEL_API_URL}/v2/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('VERCEL_CLIENT_ID'),
      client_secret: requireEnv('VERCEL_CLIENT_SECRET'),
      code,
      redirect_uri: requireEnv('VERCEL_REDIRECT_URI'),
    }),
  });

  return res.json() as Promise<VercelAccessTokenResponse>;
}

export async function listProjects(token: string, teamId?: string): Promise<VercelProject[]> {
  const res = await fetch(`${VERCEL_API_URL}/v9/projects${teamQuery(teamId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to list Vercel projects (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { projects?: VercelProject[] };
  return data.projects ?? [];
}

export function defaultNexusShieldEnvVars(): NexusShieldEnvVar[] {
  const targets: EnvTarget[] = ['production', 'preview', 'development'];

  return [
    { key: 'NEXUS_SHIELD_ENABLED', value: 'true', type: 'plain', target: targets },
    { key: 'NEXUS_SHIELD_MASK_TCKN', value: 'true', type: 'plain', target: targets },
    { key: 'NEXUS_SHIELD_MASK_CC', value: 'true', type: 'plain', target: targets },
    { key: 'NEXUS_SHIELD_MASK_EMAIL', value: 'true', type: 'plain', target: targets },
    { key: 'NEXUS_SHIELD_MASK_API_KEY', value: 'true', type: 'plain', target: targets },
  ];
}

export async function injectEnvironmentVariables(
  projectId: string,
  token: string,
  teamId?: string,
  envVars: NexusShieldEnvVar[] = defaultNexusShieldEnvVars(),
) {
  const url = `${VERCEL_API_URL}/v10/projects/${projectId}/env${teamQuery(teamId)}`;
  const results: Array<{ key: string; ok: boolean; status: number }> = [];

  for (const env of envVars) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(env),
    });

    results.push({ key: env.key, ok: res.ok, status: res.status });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Failed to inject ${env.key} (${res.status}): ${detail}`);
    }
  }

  return results;
}
