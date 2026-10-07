import type { OutcomeAdapterSystem, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';
import { awsIamOutcomeAdapter } from '@/lib/nexus-core/adapters/aws-iam';
import { databaseOutcomeAdapter } from '@/lib/nexus-core/adapters/database';
import { hubspotOutcomeAdapter } from '@/lib/nexus-core/adapters/hubspot';
import { inlineStateAdapter } from '@/lib/nexus-core/adapters/inline-state';
import { salesforceOutcomeAdapter } from '@/lib/nexus-core/adapters/salesforce';
import { sapOutcomeAdapter } from '@/lib/nexus-core/adapters/sap';

const ADAPTERS: Record<OutcomeAdapterSystem, OutcomeStateAdapter> = {
  SAP: sapOutcomeAdapter,
  SALESFORCE: salesforceOutcomeAdapter,
  HUBSPOT: hubspotOutcomeAdapter,
  DATABASE: databaseOutcomeAdapter,
  AWS_IAM: awsIamOutcomeAdapter,
  INLINE_STATE: inlineStateAdapter,
};

export function inferOutcomeAdapterSystem(toolName: string, userIntent: string): OutcomeAdapterSystem {
  const haystack = `${toolName} ${userIntent}`.toLowerCase();
  if (/sap|erp|invoice|refund|ledger|fi-ar|process_refund|process_payment/.test(haystack)) return 'SAP';
  if (/salesforce|sfdc|crm|account|opportunity/.test(haystack)) return 'SALESFORCE';
  if (/hubspot|deal|contact|purchase_order/.test(haystack)) return 'HUBSPOT';
  if (/sql|database|db_|select|insert|update|delete|dump|export_db/.test(haystack)) return 'DATABASE';
  if (/aws|iam|role_arn|sts|assume_role/.test(haystack)) return 'AWS_IAM';
  return 'INLINE_STATE';
}

export function resolveOutcomeAdapter(
  system?: OutcomeAdapterSystem,
  toolName?: string,
  userIntent?: string,
): OutcomeStateAdapter {
  const resolved =
    system ??
    (toolName && userIntent ? inferOutcomeAdapterSystem(toolName, userIntent) : 'INLINE_STATE');
  return ADAPTERS[resolved] ?? inlineStateAdapter;
}

export function listOutcomeAdapters(): OutcomeAdapterSystem[] {
  return Object.keys(ADAPTERS) as OutcomeAdapterSystem[];
}
