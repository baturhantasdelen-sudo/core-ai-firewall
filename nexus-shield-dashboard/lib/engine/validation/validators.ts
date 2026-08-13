import type { SecretValidationResult, SecretValidationStatus } from '@/lib/engine/validation/types';

const VALIDATION_TIMEOUT_MS = 2000;
const USER_AGENT = 'Nexus-Shield-Validator/1.0';

type HttpProbe = {
  url: string;
  init?: RequestInit;
  activeStatuses?: number[];
  inactiveStatuses?: number[];
};

function resultFromStatus(
  status: SecretValidationStatus,
  activeMessage: string,
  inactiveMessage: string,
  unverifiedMessage: string,
): SecretValidationResult {
  if (status === 'ACTIVE') {
    return {
      status,
      risk_score: 9.8,
      risk_level: 'CRITICAL',
      message: activeMessage,
    };
  }

  if (status === 'INACTIVE') {
    return {
      status,
      risk_score: 2.0,
      risk_level: 'LOW',
      message: inactiveMessage,
    };
  }

  return {
    status: 'UNVERIFIED',
    risk_score: 5.0,
    risk_level: 'MEDIUM',
    message: unverifiedMessage,
  };
}

async function probeHttp(probe: HttpProbe): Promise<SecretValidationStatus> {
  try {
    const response = await fetch(probe.url, {
      ...probe.init,
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        ...(probe.init?.headers ?? {}),
      },
    });

    const activeStatuses = probe.activeStatuses ?? [200];
    const inactiveStatuses = probe.inactiveStatuses ?? [401, 403];

    if (activeStatuses.includes(response.status)) return 'ACTIVE';
    if (inactiveStatuses.includes(response.status)) return 'INACTIVE';
    return 'UNVERIFIED';
  } catch {
    return 'UNVERIFIED';
  }
}

export async function validateOpenAiKey(secret: string): Promise<SecretValidationResult> {
  const status = await probeHttp({
    url: 'https://api.openai.com/v1/models',
    init: {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    },
  });

  return resultFromStatus(
    status,
    'Active OpenAI API key detected in source code!',
    'OpenAI API key appears invalid or revoked.',
    'Could not verify OpenAI API key status.',
  );
}

export async function validateStripeKey(secret: string): Promise<SecretValidationResult> {
  const status = await probeHttp({
    url: 'https://api.stripe.com/v1/balance',
    init: {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    },
  });

  return resultFromStatus(
    status,
    'Active Stripe secret key detected in source code!',
    'Stripe secret key appears invalid or revoked.',
    'Could not verify Stripe secret key status.',
  );
}

export async function validateGitHubToken(secret: string): Promise<SecretValidationResult> {
  const status = await probeHttp({
    url: 'https://api.github.com/user',
    init: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/vnd.github+json',
      },
    },
  });

  return resultFromStatus(
    status,
    'Active GitHub token detected in source code!',
    'GitHub token appears invalid or revoked.',
    'Could not verify GitHub token status.',
  );
}

export async function validateGcpApiKey(secret: string): Promise<SecretValidationResult> {
  const status = await probeHttp({
    url: `https://www.googleapis.com/discovery/v1/apis?key=${encodeURIComponent(secret)}`,
    init: { method: 'GET' },
    inactiveStatuses: [400, 401, 403],
  });

  return resultFromStatus(
    status,
    'Active GCP API key detected in source code!',
    'GCP API key appears invalid or revoked.',
    'Could not verify GCP API key status.',
  );
}

export async function validateNpmToken(secret: string): Promise<SecretValidationResult> {
  const status = await probeHttp({
    url: 'https://registry.npmjs.org/-/whoami',
    init: {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    },
  });

  return resultFromStatus(
    status,
    'Active npm access token detected in source code!',
    'npm access token appears invalid or revoked.',
    'Could not verify npm access token status.',
  );
}

export async function validateAwsAccessKey(_secret: string): Promise<SecretValidationResult> {
  return resultFromStatus(
    'UNVERIFIED',
    'Active AWS credentials detected in source code!',
    'AWS access key appears invalid or revoked.',
    'AWS access key format detected; paired secret is required for live validation.',
  );
}

export async function validatePyPiToken(_secret: string): Promise<SecretValidationResult> {
  return resultFromStatus(
    'UNVERIFIED',
    'Active PyPI API token detected in source code!',
    'PyPI API token appears invalid or revoked.',
    'PyPI token format detected; live validation is not available for this token type.',
  );
}

export async function validateGenericSecret(_secret: string): Promise<SecretValidationResult> {
  return resultFromStatus(
    'UNVERIFIED',
    'Active secret detected in source code!',
    'Secret appears invalid or revoked.',
    'Secret pattern detected; provider-specific live validation unavailable.',
  );
}
