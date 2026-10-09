/** Client-side ESTIMATE only — not production risk scoring. */

export interface AssessmentInput {
  workEmail: string;
  companySize: string;
  agentCount: number;
  mcpUsage: boolean;
  financialActions: boolean;
  erpUsage: boolean;
  crmUsage: boolean;
  iamUsage: boolean;
  cloudActions: boolean;
}

export interface AssessmentReport {
  label: 'ESTIMATE' | 'DEMO';
  discoveredAgents: number;
  highRiskAgents: number;
  unboundedAuthority: number;
  criticalActions: number;
  potentialFalseSuccessCases: number;
  summary: string;
}

function hashEmail(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return h;
}

export function generateAssessmentReport(input: AssessmentInput): AssessmentReport {
  const h = hashEmail(input.workEmail.toLowerCase().trim());
  const scale = Math.max(1, input.agentCount);
  const discoveredAgents = Math.min(99, scale + (h % 12));
  const highRiskAgents = Math.min(discoveredAgents, Math.floor(discoveredAgents * 0.25) + (input.mcpUsage ? 2 : 0));
  const unboundedAuthority = Math.min(highRiskAgents, 1 + (h % 4));
  let criticalActions = scale * 2 + (input.financialActions ? 8 : 0) + (input.erpUsage ? 5 : 0);
  criticalActions = Math.min(120, criticalActions);
  const potentialFalseSuccessCases =
    (input.financialActions ? 1 : 0) + (input.erpUsage ? 1 : 0) + (input.cloudActions ? 1 : 0);

  return {
    label: 'ESTIMATE',
    discoveredAgents,
    highRiskAgents,
    unboundedAuthority,
    criticalActions,
    potentialFalseSuccessCases,
    summary:
      'This report is a deterministic estimate from your form inputs — not a scan of your environment. Request a technical assessment for authoritative findings.',
  };
}
