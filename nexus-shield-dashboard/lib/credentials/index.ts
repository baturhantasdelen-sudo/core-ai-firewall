import {
  requestJitCredential,
  resetJitCredentialBrokerStore,
} from '@/lib/credentials/broker';

export type {
  CredentialRequest,
  CredentialRequestResult,
  CredentialRevokeResult,
  CredentialScope,
  CredentialStatus,
  JitCredential,
} from '@/lib/credentials/types';

export {
  CRITICAL_RISK_DENY_THRESHOLD,
  CRITICAL_RISK_REVOKE_THRESHOLD,
  DEFAULT_JIT_TTL_SECONDS,
  isActiveCredential,
  remainingTtlMs,
  ttlPercentRemaining,
} from '@/lib/credentials/types';

export {
  __testExpireToken,
  getJitCredential,
  listActiveJitCredentials,
  listAllJitCredentials,
  purgeExpiredTokens,
  requestJitCredential,
  resetJitCredentialBrokerStore,
  revokeAgentTokensOnRiskEscalation,
  revokeJitCredential,
  setAgentRiskScore,
} from '@/lib/credentials/broker';

/** Seed demo credentials for dashboard initial state. */
export function buildMockJitCredentials(): void {
  resetJitCredentialBrokerStore();

  requestJitCredential({
    agentId: 'langchain-support-agent-1',
    targetResource: 'invoices/read',
    scope: 'READ',
    riskScore: 12,
    ttlSeconds: 30,
  });

  requestJitCredential({
    agentId: 'crewai-ops-agent-1',
    targetResource: 'customer-database/export',
    scope: 'WRITE',
    riskScore: 48,
    ttlSeconds: 30,
  });

  requestJitCredential({
    agentId: 'openai-assistant-1',
    targetResource: 'shell/production-deploy',
    scope: 'EXECUTE',
    riskScore: 35,
    ttlSeconds: 30,
  });
}
