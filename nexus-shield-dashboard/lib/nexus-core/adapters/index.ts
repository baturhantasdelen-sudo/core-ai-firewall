export type {
  ExternalStateResult,
  OutcomeAdapterContext,
  OutcomeAdapterSystem,
  OutcomeStateAdapter,
} from '@/lib/nexus-core/adapters/types';
export {
  inferOutcomeAdapterSystem,
  listOutcomeAdapters,
  resolveOutcomeAdapter,
} from '@/lib/nexus-core/adapters/registry';
export { sapOutcomeAdapter } from '@/lib/nexus-core/adapters/sap';
export { salesforceOutcomeAdapter } from '@/lib/nexus-core/adapters/salesforce';
export { hubspotOutcomeAdapter } from '@/lib/nexus-core/adapters/hubspot';
export { databaseOutcomeAdapter } from '@/lib/nexus-core/adapters/database';
export { awsIamOutcomeAdapter } from '@/lib/nexus-core/adapters/aws-iam';
export * from '@/lib/nexus-core/adapters/vertical';
