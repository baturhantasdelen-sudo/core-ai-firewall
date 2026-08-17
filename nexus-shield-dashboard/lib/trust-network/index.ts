export type {
  AgentPassport,
  B2BTrustLevel,
  B2BTrustMatrixEntry,
  IssuePassportInput,
  PassportActionResult,
  PassportStatus,
  PassportVerification,
} from '@/lib/trust-network/types';

export {
  buildB2BTrustMatrix,
  buildMockAgentPassports,
  getAgentPassport,
  issueAgentPassport,
  listAgentPassports,
  resetTrustNetworkStore,
  revokeAgentPassport,
  suspendAgentPassport,
  verifyAgentPassport,
} from '@/lib/trust-network/passport';
