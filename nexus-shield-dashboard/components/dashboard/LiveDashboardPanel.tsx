'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, ScanSearch, ShieldAlert, Zap } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ScanRecord } from '@/lib/mock-dashboard-data';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ScanHistoryTable } from '@/components/dashboard/ScanHistoryTable';
import { UsageLimitCard } from '@/components/dashboard/UsageLimitCard';
import {
  applyScanToMetrics,
  mapScanFromRealtime,
  type ScanMetrics,
} from '@/lib/scans';

interface LiveDashboardPanelProps {
  orgId: string;
  initialScans: ScanRecord[];
  initialMetrics: ScanMetrics;
  initialUsageUsed: number;
  usageLimit: number;
  plan: 'free' | 'pro';
}

function TriggerTestScanButton({ onScan }: { onScan: (scan: ScanRecord) => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleTrigger() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/mock-scan', { method: 'POST' });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        scan?: ScanRecord;
      };

      if (!response.ok) {
        setMessage(data.error ?? 'Mock scan failed');
        return;
      }

      setMessage(data.message ?? 'Mock scan triggered');
      if (data.scan) {
        onScan(data.scan);
      }
    } catch {
      setMessage('Could not trigger mock scan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleTrigger}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        Trigger Test Scan
      </button>
      {message ? <span className="text-xs text-zinc-400">{message}</span> : null}
    </div>
  );
}

export function LiveDashboardPanel({
  orgId,
  initialScans,
  initialMetrics,
  initialUsageUsed,
  usageLimit,
  plan,
}: LiveDashboardPanelProps) {
  const [scans, setScans] = useState(initialScans);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [usageUsed, setUsageUsed] = useState(initialUsageUsed);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  const prependScan = useCallback((scan: ScanRecord) => {
    setScans((current) => {
      if (current.some((row) => row.id === scan.id)) return current;
      return [scan, ...current].slice(0, 20);
    });
    setMetrics((current) => applyScanToMetrics(current, scan));
    setUsageUsed((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      const supabase = createSupabaseBrowserClient();

      const channel = supabase
        .channel(`scan_results:${orgId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'scan_results',
            filter: `org_id=eq.${orgId}`,
          },
          (payload) => {
            if (cancelled || !payload.new) return;
            prependScan(mapScanFromRealtime(payload.new as Record<string, unknown>));
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') {
            setLiveStatus('live');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setLiveStatus('offline');
          }
        });

      return () => {
        cancelled = true;
        void supabase.removeChannel(channel);
      };
    } catch {
      setLiveStatus('offline');
      return undefined;
    }
  }, [orgId, prependScan]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TriggerTestScanButton onScan={prependScan} />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            liveStatus === 'live'
              ? 'bg-emerald-500/10 text-emerald-300'
              : liveStatus === 'connecting'
                ? 'bg-zinc-500/10 text-zinc-400'
                : 'bg-amber-500/10 text-amber-300'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              liveStatus === 'live'
                ? 'bg-emerald-400 animate-pulse'
                : liveStatus === 'connecting'
                  ? 'bg-zinc-400'
                  : 'bg-amber-400'
            }`}
          />
          {liveStatus === 'live'
            ? 'Realtime connected'
            : liveStatus === 'connecting'
              ? 'Connecting realtime…'
              : 'Realtime offline — refresh to update'}
        </span>
      </div>

      <UsageLimitCard used={usageUsed} limit={usageLimit} plan={plan} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ScanSearch} label="Total Scans Executed" value={metrics.totalScans.toString()} />
        <MetricCard
          icon={KeyRound}
          label="Active Secrets Blocked"
          value={metrics.secretsBlocked.toString()}
          accent="red"
        />
        <MetricCard
          icon={ShieldAlert}
          label="PII Leaks Blocked"
          value={metrics.piiLeaksBlocked.toString()}
          accent="yellow"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Security Compliance Score"
          value={`${metrics.complianceScore}%`}
          accent="green"
        />
      </div>

      <ScanHistoryTable scans={scans} />
    </>
  );
}
