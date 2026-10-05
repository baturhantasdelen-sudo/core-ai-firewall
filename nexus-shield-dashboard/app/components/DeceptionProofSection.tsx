'use client';

import { useState } from 'react';
import {
  DECEPTION_SCENARIO_ORDER,
  type DeceptionScenarioId,
  getDeceptionScenario,
} from '@/lib/landing/deception-demo';
import { CinematicVideoPlayer } from '@/app/components/CinematicVideoPlayer';
import { InteractiveDeceptionSandbox } from '@/app/components/InteractiveDeceptionSandbox';

export function DeceptionProofSection() {
  const [scenarioId, setScenarioId] = useState<DeceptionScenarioId>('financial');
  const scenario = getDeceptionScenario(scenarioId);

  return (
    <>
      <div className="mx-auto mt-10 max-w-4xl">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Tripartite outcomes · VERIFIED · BLOCKED · UNVERIFIED (ghost action)
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {DECEPTION_SCENARIO_ORDER.map((id) => {
            const item = getDeceptionScenario(id);
            const active = id === scenarioId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setScenarioId(id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                    : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {item.pillLabel}
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-zinc-400">{scenario.subtitle}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2 xl:items-stretch">
        <CinematicVideoPlayer key={scenarioId} scenario={scenario} />
        <InteractiveDeceptionSandbox key={scenarioId} scenario={scenario} />
      </div>
    </>
  );
}
