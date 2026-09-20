import type { GuardAdapter, GuardDecision, HarnessScenario } from '../types.js';

export interface HttpAgentActionConfig {
  baseUrl: string;
  actionPath?: string;
  healthPath?: string;
  agentId?: string;
  sessionPrefix?: string;
  apiKey?: string;
  timeoutMs?: number;
}

function mapStatusToDecision(status: string): GuardDecision {
  const normalized = status.toUpperCase();
  if (normalized === 'REJECTED' || normalized === 'BLOCKED') return 'BLOCK';
  if (normalized === 'PENDING_APPROVAL' || normalized === 'REQUIRE_APPROVAL') return 'REQUIRE_APPROVAL';
  if (normalized === 'EXECUTED' || normalized === 'APPROVED' || normalized === 'ALLOW') return 'ALLOW';
  return 'ERROR';
}

export class HttpAgentActionAdapter implements GuardAdapter {
  readonly name = 'http-agent-action';
  private readonly config: Required<Omit<HttpAgentActionConfig, 'apiKey'>> & { apiKey?: string };

  constructor(config: HttpAgentActionConfig) {
    this.config = {
      actionPath: '/v1/agent/action',
      healthPath: '/healthz',
      agentId: 'harness-agent-01',
      sessionPrefix: 'harness-sess',
      timeoutMs: 15_000,
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
    };
  }

  async evaluate(scenario: HarnessScenario): Promise<{
    decision: GuardDecision;
    violations: string[];
    rawResponse?: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Nexus-Agent-Id': this.config.agentId,
        'X-Session-Id': `${this.config.sessionPrefix}-${scenario.id}`,
      };
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      const payload = {
        tool_name: scenario.toolName,
        arguments: scenario.toolArgs,
        user_prompt: scenario.userIntent,
        tool_purpose: scenario.category,
      };

      const response = await fetch(`${this.config.baseUrl}${this.config.actionPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        return {
          decision: 'ERROR',
          violations: [`HTTP_${response.status}`],
          rawResponse: raw.slice(0, 500),
        };
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {
          decision: 'ERROR',
          violations: ['INVALID_JSON'],
          rawResponse: raw.slice(0, 500),
        };
      }

      const status = String(body.status ?? body.decision ?? 'UNKNOWN');
      const violations = Array.isArray(body.violations)
        ? body.violations.map(String)
        : body.reason
          ? [String(body.reason)]
          : [];

      return {
        decision: mapStatusToDecision(status),
        violations,
        rawResponse: raw.slice(0, 500),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        decision: 'ERROR',
        violations: ['REQUEST_FAILED'],
        rawResponse: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
