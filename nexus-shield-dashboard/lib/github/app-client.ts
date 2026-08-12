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
  // usually stored with literal "\n" escapes instead of real newlines. Some
  // .env parsers (dotenv, used by Next.js) additionally expand "\n" inside
  // double-quoted values themselves, so a key pasted with *both* literal
  // "\n" prefixes *and* real line breaks ends up with doubled newlines by
  // the time it reaches process.env — that's invalid PEM and fails to parse.
  // Normalize unconditionally: expand any literal escapes, unify line
  // endings, then collapse consecutive newlines down to one.
  const privateKey = rawPrivateKey
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

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
