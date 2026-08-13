export type SecretValidationStatus = 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';

export type SecretValidationRiskLevel = 'CRITICAL' | 'LOW' | 'MEDIUM';

export interface SecretValidationResult {
  status: SecretValidationStatus;
  risk_score: number;
  risk_level: SecretValidationRiskLevel;
  message: string;
}
