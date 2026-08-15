export type {
  ActionFirewallInput,
  ActionFirewallResult,
  AdaptiveDegradationState,
  DegradationLevel,
  FirewallDecisionLabel,
} from '@/lib/firewall/types';

export { DEGRADATION_LEVEL_META } from '@/lib/firewall/types';

export {
  evaluateActionFirewall,
  forceRevokeCapabilities,
  getDegradationState,
  resetFirewallState,
  simulateDegradeMode,
} from '@/lib/firewall/interceptor';
