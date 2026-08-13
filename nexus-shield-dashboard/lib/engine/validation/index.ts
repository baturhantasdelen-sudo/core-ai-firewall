import type { DetectionMatch } from '@/lib/engine/types';
import type { SecretValidationResult } from '@/lib/engine/validation/types';
import {
  validateAwsAccessKey,
  validateGenericSecret,
  validateGcpApiKey,
  validateGitHubToken,
  validateNpmToken,
  validateOpenAiKey,
  validatePyPiToken,
  validateStripeKey,
} from '@/lib/engine/validation/validators';

type ValidatorFn = (secret: string) => Promise<SecretValidationResult>;

const VALIDATORS: Record<string, ValidatorFn> = {
  'openai-api-key': validateOpenAiKey,
  'stripe-secret-key': validateStripeKey,
  'github-token': validateGitHubToken,
  'gcp-api-key': validateGcpApiKey,
  'npm-token': validateNpmToken,
  'aws-access-key': validateAwsAccessKey,
  'pypi-token': validatePyPiToken,
  'generic-secret': validateGenericSecret,
  'generic-api-key': validateGenericSecret,
  'high-entropy-secret': validateGenericSecret,
};

export type ValidatedFinding = DetectionMatch & {
  validation?: SecretValidationResult;
};

export async function validateSecret(ruleId: string, secretValue: string): Promise<SecretValidationResult> {
  const validator = VALIDATORS[ruleId] ?? validateGenericSecret;
  return validator(secretValue);
}

export async function validateSecretFindings(
  findings: DetectionMatch[],
): Promise<ValidatedFinding[]> {
  const secretFindings = findings.filter((finding) => finding.category === 'secret');

  if (secretFindings.length === 0) {
    return findings;
  }

  const validations = await Promise.all(
    secretFindings.map(async (finding) => ({
      key: `${finding.ruleId}:${finding.line}:${finding.column}:${finding.matched}`,
      validation: await validateSecret(finding.ruleId, finding.matched),
    })),
  );

  const validationMap = new Map(validations.map((entry) => [entry.key, entry.validation]));

  return findings.map((finding) => {
    if (finding.category !== 'secret') return finding;

    const key = `${finding.ruleId}:${finding.line}:${finding.column}:${finding.matched}`;
    const validation = validationMap.get(key);
    return validation ? { ...finding, validation } : finding;
  });
}

export type { SecretValidationResult, SecretValidationStatus } from '@/lib/engine/validation/types';
