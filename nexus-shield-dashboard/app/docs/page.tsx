'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Play, Terminal } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface ApiEndpointDoc {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  requestExample?: object;
  responseExample: object;
  curl: string;
}

const ENDPOINTS: ApiEndpointDoc[] = [
  {
    id: 'evaluate',
    method: 'POST',
    path: '/api/v1/action/evaluate',
    title: 'Action Firewall & Intent Divergence',
    description:
      'Evaluates a single agent tool call against declared capabilities, user intent, evidence chain, and divergence scoring.',
    requestExample: {
      agent_id: 'crewai-ops-agent-1',
      user_intent: 'Check August Invoice 8291 for Acme Corp',
      tool_call: { name: 'export_customer_database', args: { table: 'customers' } },
      agent_capabilities: ['READ', 'DB_QUERY'],
    },
    responseExample: {
      success: false,
      decision: 'BLOCK',
      risk_score: 88,
      intent_match_score: 35,
      intent_divergence_percent: 96,
      agent_status: 'READ_ONLY',
      capabilities_revoked: true,
      violations: ['INTENT_ACTION_DIVERGENCE: 96% mismatch between user intent and action trajectory'],
      kill_switch_triggered: false,
      latency_ms: 4.2,
    },
    curl: `curl -X POST "$BASE_URL/api/v1/action/evaluate" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $NEXUS_API_KEY" \\
  -d '{
    "agent_id": "crewai-ops-agent-1",
    "user_intent": "Check August Invoice 8291 for Acme Corp",
    "tool_call": { "name": "export_customer_database", "args": { "table": "customers" } },
    "agent_capabilities": ["READ", "DB_QUERY"]
  }'`,
  },
  {
    id: 'trust-post',
    method: 'POST',
    path: '/api/v1/agent/trust',
    title: 'Inter-Agent Trust Delegation',
    description:
      'Verifies whether source agent may delegate work to target agent. Returns ALLOW_DELEGATION, REQUIRE_HUMAN_APPROVAL, or DENY_DELEGATION.',
    requestExample: {
      source_agent_id: 'langchain-support-agent-1',
      target_agent_id: 'crewai-ops-agent-1',
    },
    responseExample: {
      success: true,
      decision: 'DENY_DELEGATION',
      trust: {
        sourceAgentId: 'langchain-support-agent-1',
        targetAgentId: 'crewai-ops-agent-1',
        trusted: false,
        trustScore: 38,
        targetReputation: 41,
        recommendation: 'DENY_DELEGATION',
        rationale: ['Target agent has unresolved CRITICAL incidents'],
      },
    },
    curl: `curl -X POST "$BASE_URL/api/v1/agent/trust" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $NEXUS_API_KEY" \\
  -d '{
    "source_agent_id": "langchain-support-agent-1",
    "target_agent_id": "crewai-ops-agent-1"
  }'`,
  },
  {
    id: 'trust-get',
    method: 'GET',
    path: '/api/v1/agent/trust?agent_id=langchain-support-agent-1',
    title: 'Agent Reputation Card',
    description:
      'Returns live Agent Reputation Card with trust score, risk badge, success rate, evidence verification ratio, and memory integrity score.',
    responseExample: {
      success: true,
      reputation_card: {
        agentId: 'langchain-support-agent-1',
        reputationScore: 82,
        riskBadge: 'LOW',
        metrics: {
          successRate: 99,
          blockedViolations: 1,
          evidenceVerificationRatio: 100,
          memoryIntegrityScore: 100,
        },
      },
    },
    curl: `curl "$BASE_URL/api/v1/agent/trust?agent_id=langchain-support-agent-1" \\
  -H "x-api-key: $NEXUS_API_KEY"`,
  },
  {
    id: 'demo-run',
    method: 'POST',
    path: '/api/v1/demo/run',
    title: 'E2E Pitch Demo Scenario',
    description:
      'Runs the investor-ready invoice → export → external upload mitigation scenario through the full SEE → CONTROL → TRUST engine stack.',
    responseExample: {
      success: true,
      scenario: {
        userIntent: 'Check August Invoice 8291 for Acme Corp',
        finalDivergenceScore: 96,
        capabilityMode: 'READ_ONLY',
        evidenceStatus: 'UNVERIFIED_ACTION',
        reputationBefore: 92,
        reputationAfter: 45,
      },
    },
    curl: `curl -X POST "$BASE_URL/api/v1/demo/run" \\
  -H "x-api-key: $NEXUS_API_KEY"`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fail silently
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy cURL'}
    </button>
  );
}

function TryItOut({ endpoint }: { endpoint: ApiEndpointDoc }) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : 'https://nexus-shield-dashboard.vercel.app',
  );
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleTry() {
    if (!apiKey.trim()) {
      setResponse('Error: Enter your x-api-key to try this endpoint.');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      const fetchUrl = `${baseUrl.replace(/\/$/, '')}${endpoint.path}`;

      const res = await fetch(fetchUrl, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body:
          endpoint.method === 'POST' && endpoint.requestExample
            ? JSON.stringify(endpoint.requestExample)
            : undefined,
      });

      const data = await res.json();
      setResponse(JSON.stringify({ status: res.status, ...data }, null, 2));
    } catch (err) {
      setResponse(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-zinc-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Try it out</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-zinc-500">
          Base URL
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/40"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          x-api-key
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="nex_..."
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/40"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleTry}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        <Play className="h-3.5 w-3.5" />
        {loading ? 'Sending...' : 'Send Request'}
      </button>
      {response ? (
        <pre className="max-h-64 overflow-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
          {response}
        </pre>
      ) : null}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <BrandLogo size={28} />
          <div className="min-w-0 flex-1">
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nexus Shield API Reference</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Runtime security endpoints for Action Firewall, Inter-Agent Trust, and E2E demo scenarios.
            </p>
          </div>
          <Link
            href="/dashboard/simulator"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-sm text-orange-200"
          >
            <Terminal className="h-4 w-4" />
            Live Demo
          </Link>
        </div>

        <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-zinc-400">
          Authenticate all requests with <code className="text-emerald-300">x-api-key</code> or{' '}
          <code className="text-emerald-300">x-nexus-api-key</code>. Set{' '}
          <code className="text-zinc-300">BASE_URL</code> to your dashboard origin or production host.
        </div>

        <div className="space-y-8">
          {ENDPOINTS.map((endpoint) => (
            <article
              key={endpoint.id}
              id={endpoint.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl"
            >
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                      endpoint.method === 'POST'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <code className="break-all font-mono text-sm text-zinc-200">{endpoint.path}</code>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-zinc-50">{endpoint.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{endpoint.description}</p>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">cURL</p>
                    <CopyButton text={endpoint.curl} />
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
                    {endpoint.curl}
                  </pre>
                </div>

                {endpoint.requestExample ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Request</p>
                    <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
                      {JSON.stringify(endpoint.requestExample, null, 2)}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Response</p>
                  <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
                    {JSON.stringify(endpoint.responseExample, null, 2)}
                  </pre>
                </div>

                <TryItOut endpoint={endpoint} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
