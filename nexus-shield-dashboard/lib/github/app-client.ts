import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

interface GithubAppCredentials {
  appId: string;
  privateKey: string;
}

let cachedCredentials: GithubAppCredentials | null = null;

function getAppCredentials(): GithubAppCredentials {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const appId = process.env.GITHUB_APP_ID;
  const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !rawPrivateKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY environment variables');
  }

  // Most hosting providers only accept single-line env vars, so PEM keys are
  // usually stored with literal "\n" escapes instead of real newlines.
  const privateKey = rawPrivateKey.includes('\\n') ? rawPrivateKey.replace(/\\n/g, '\n') : rawPrivateKey;

  cachedCredentials = { appId, privateKey };
  return cachedCredentials;
}

/**
 * Returns an Octokit client authenticated as a specific GitHub App
 * installation (i.e. scoped to the repositories that installation can
 * access). A fresh client is created per call since installation tokens are
 * short-lived and installation-specific.
 */
export function getInstallationOctokit(installationId: number): Octokit {
  const { appId, privateKey } = getAppCredentials();

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
}
