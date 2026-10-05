'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { DeceptionScenario } from '@/lib/landing/deception-demo';
import { TripartiteOutcomeBanner } from '@/app/components/TripartiteOutcomeBanner';
import { getTripartiteMeta } from '@/lib/landing/tripartite-state';

const DURATION_MS = 20_000;

const BADGE_STYLES = {
  cyan: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]',
  amber: 'border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.2)]',
  rose: 'border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
  emerald:
    'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.25)]',
  violet:
    'border-violet-500/40 bg-violet-500/15 text-violet-200 shadow-[0_0_20px_rgba(167,139,250,0.25)]',
} as const;

export interface CinematicVideoPlayerProps {
  scenario: DeceptionScenario;
}

export function CinematicVideoPlayer({ scenario }: CinematicVideoPlayerProps) {
  const steps = scenario.timelineSteps;
  const stepMs = DURATION_MS / steps.length;

  const [playing, setPlaying] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
    setElapsedMs(0);
    setPlaying(true);
  }, [scenario.id]);

  useEffect(() => {
    elapsedRef.current = elapsedMs;
  }, [elapsedMs]);

  useEffect(() => {
    if (!playing) return;
    if (elapsedRef.current >= DURATION_MS) return;

    let frame = 0;
    let startTime: number | null = null;

    const loop = (now: number) => {
      if (startTime === null) startTime = now - elapsedRef.current;
      const next = now - startTime;
      if (next >= DURATION_MS) {
        elapsedRef.current = DURATION_MS;
        setElapsedMs(DURATION_MS);
        setPlaying(false);
        return;
      }
      elapsedRef.current = next;
      setElapsedMs(next);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, scenario.id]);

  const progress = Math.min(100, (elapsedMs / DURATION_MS) * 100);
  const activeIndex = Math.min(steps.length - 1, Math.floor(elapsedMs / stepMs));
  const activeStep = steps[activeIndex];
  const tripartite = getTripartiteMeta(scenario.tripartiteState);
  const cinematicHeadline =
    activeStep.id === 'false-success' || activeStep.badge === 'FALSE SUCCESS'
      ? scenario.tripartiteHeadline
      : activeStep.id === 'verify' && scenario.tripartiteState === 'UNVERIFIED'
        ? 'Ghost action detected — API success without ledger mutation.'
        : activeStep.id === 'breaker' && scenario.tripartiteState === 'BLOCKED'
          ? scenario.tripartiteHeadline
          : activeStep.id === 'block'
            ? scenario.tripartiteHeadline
            : undefined;

  const restart = () => {
    elapsedRef.current = 0;
    setElapsedMs(0);
    setPlaying(true);
  };

  const timeLabel = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const total = Math.floor(DURATION_MS / 1000);
    return `${String(s).padStart(2, '0')}s / ${total}s`;
  }, [elapsedMs]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_55%)]"
      />

      <div className="relative border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {playing ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
              ) : null}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${playing ? 'bg-rose-400' : 'bg-zinc-500'}`}
              />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {scenario.pillLabel} · cinematic
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${BADGE_STYLES[activeStep.badgeTone]}`}
            >
              {activeStep.badge}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${tripartite.border} ${tripartite.bg} ${tripartite.text}`}
            >
              {scenario.tripartiteState}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <TripartiteOutcomeBanner
            activeState={scenario.tripartiteState}
            headline={cinematicHeadline}
            compact
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-zinc-100 transition hover:border-cyan-500/40 hover:text-cyan-200"
            aria-label={playing ? 'Pause demo' : 'Play demo'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-zinc-400 transition hover:text-zinc-200"
            aria-label="Restart demo"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 transition-[width] duration-150 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] text-zinc-500">{timeLabel}</p>
          </div>
        </div>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Timeline</p>
          <ul className="mt-4 space-y-2">
            {steps.map((step, index) => {
              const isActive = index === activeIndex;
              const isPast = index < activeIndex;
              return (
                <li
                  key={step.id}
                  className={`rounded-xl border px-3 py-2.5 transition-all duration-500 ${
                    isActive
                      ? 'border-cyan-500/35 bg-cyan-500/10'
                      : isPast
                        ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
                        : 'border-white/5 bg-zinc-900/40 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-zinc-200">
                      {index + 1}. {step.title}
                    </span>
                    {isPast ? (
                      <span className="text-[10px] text-emerald-400">✓</span>
                    ) : isActive ? (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative min-h-[280px] p-5 sm:min-h-[320px]">
          <div key={`${scenario.id}-${activeStep.id}`} className="transition-opacity duration-500">
            <h3 className="text-lg font-semibold text-zinc-50 sm:text-xl">{activeStep.headline}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{activeStep.detail}</p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-cyan-100/90 sm:text-xs">
              {activeStep.terminal.join('\n')}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
