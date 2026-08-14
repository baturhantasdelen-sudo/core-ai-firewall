'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Shield,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { AgentAsset } from '@/lib/engine/discovery';
import type { SimulationReport, SimulationVectorResult } from '@/lib/engine/simulator';

interface RedTeamSimulatorPanelProps {
  agents: AgentAsset[];
  apiKey: string;
}

const vectorLabels: Record<string, string> = {
  INDIRECT_PROMPT_INJECTION: 'Indirect Prompt Injection',
  GOAL_HIJACKING: 'Goal Hijacking',
  PRIVILEGE_ESCALATION: 'Privilege Escalation',
  DATA_EXFILTRATION_TOOL_MISUSE: 'Data Exfiltration / Tool Misuse',
  SYSTEM_PROMPT_LEAKAGE: 'System Prompt Leakage',
};

function riskTone(rating: SimulationReport['riskRating']): string {
  switch (rating) {
    case 'EXCELLENT':
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'MODERATE':
      return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    case 'VULNERABLE':
      return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    default:
      return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  }
}

function ResilienceRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="rgb(39 39 42)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#resilienceGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="resilienceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-zinc-50">{score}</span>
        <span className="text-xs text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

export function RedTeamSimulatorPanel({ agents, apiKey }: RedTeamSimulatorPanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const appendLine = useCallback((line: string) => {
    setConsoleLines((prev) => [...prev, line]);
  }, []);

  const runSimulation = useCallback(async () => {
    if (!selectedAgentId) return;

    setRunning(true);
    setError(null);
    setReport(null);
    setConsoleLines([
      '[nexus-redteam] Initializing AI Agent Red Teaming Simulator...',
      `[nexus-redteam] Target agent: ${selectedAgentId}`,
      '[nexus-redteam] Loading Action Firewall shield...',
    ]);

    try {
      appendLine('[nexus-redteam] Executing 5 attack vectors against runtime policy engine...');

      const response = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ agent_id: selectedAgentId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Simulation failed');
      }

      const simulationReport = data.report as SimulationReport;

      for (const result of simulationReport.results) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        appendLine(
          `[${result.status === 'PASSED_BLOCKED' ? 'BLOCKED' : 'EXPOSED'}] ${result.vector} → risk=${result.riskScore}`,
        );
        appendLine(`  payload: ${result.payload.slice(0, 120)}...`);
        appendLine(`  response: ${result.response}`);
      }

      appendLine(
        `[nexus-redteam] Simulation complete — resilience=${simulationReport.resilienceScore}/100 (${simulationReport.riskRating})`,
      );
      setReport(simulationReport);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setError(message);
      appendLine(`[ERROR] ${message}`);
    } finally {
      setRunning(false);
    }
  }, [apiKey, appendLine, selectedAgentId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label htmlFor="agent-select" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Select Agent to Attack
            </label>
            <select
              id="agent-select"
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              disabled={running}
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.framework}) — {agent.riskLevel}
                </option>
              ))}
            </select>
            {selectedAgent ? (
              <p className="mt-2 text-xs text-zinc-500">
                Capabilities: {selectedAgent.capabilities.join(', ')} · Source: {selectedAgent.sourceFile}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={runSimulation}
            disabled={running || !selectedAgentId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Crosshair className="h-4 w-4" />
            {running ? 'Running Simulation...' : 'Run Red Team Attack Simulation'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-4 py-3">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Red Team Console
            </span>
          </div>
          <pre className="max-h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed text-zinc-300">
            {consoleLines.length > 0
              ? consoleLines.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className={
                      line.includes('[BLOCKED]')
                        ? 'text-emerald-400'
                        : line.includes('[EXPOSED]')
                          ? 'text-rose-400'
                          : line.includes('[ERROR]')
                            ? 'text-rose-300'
                            : 'text-zinc-400'
                    }
                  >
                    {line}
                  </div>
                ))
              : '$ awaiting simulation command...'}
          </pre>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Resilience Score</h3>
          </div>

          {report ? (
            <div className="mt-4 space-y-4">
              <ResilienceRing score={report.resilienceScore} />
              <div className="text-center">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${riskTone(report.riskRating)}`}
                >
                  {report.riskRating}
                </span>
              </div>
              <p className="text-center text-xs text-zinc-500">
                {report.results.filter((r) => r.status === 'PASSED_BLOCKED').length} of{' '}
                {report.results.length} attack vectors blocked by Action Firewall
              </p>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-zinc-500">
              Run a simulation to generate resilience metrics.
            </p>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {report ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Vector Results
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Attack Vector</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Risk Score</th>
                  <th className="px-5 py-3">Firewall Response</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map((result: SimulationVectorResult) => (
                  <tr key={result.vector} className="border-t border-white/5">
                    <td className="px-5 py-4 font-medium text-zinc-200">
                      {vectorLabels[result.vector] ?? result.vector}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          result.status === 'PASSED_BLOCKED'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {result.status === 'PASSED_BLOCKED' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {result.status === 'PASSED_BLOCKED' ? 'Blocked' : 'Exposed'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-300">{result.riskScore}</td>
                    <td className="max-w-md px-5 py-4 text-xs text-zinc-500">{result.response}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 border-t border-white/10 px-5 py-4 text-xs text-zinc-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            Simulations execute against the in-process Action Firewall engine — no live agent endpoints
            are contacted. Payloads are synthetic red-team probes.
          </div>
        </div>
      ) : null}
    </div>
  );
}
