"use client";

import { useState } from "react";
import { LiveDot } from "@/components/live-dot";
import { hurricaneCategory, relativeTime } from "@/lib/format";
import type { PreplanSummary } from "@/lib/types";

const LIVE_WINDOW_MS = 5 * 60 * 1000;

export function RecentPreplans({
  preplans,
  preplanCount,
}: {
  preplans: PreplanSummary[];
  preplanCount: number;
}) {
  const [now] = useState(() => Date.now());
  const live =
    preplans.length > 0 && now - new Date(preplans[0].created_at).getTime() < LIVE_WINDOW_MS;

  return (
    <aside className="absolute bottom-5 left-5 z-10 w-[360px] rounded-md border border-white/[0.08] bg-black/85 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/70">
          RECENT PRE-PLANS
        </span>
        {live ? (
          <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-[#ff6b00]">
            <LiveDot />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="flex max-h-[55vh] flex-col divide-y divide-white/[0.06] overflow-y-auto px-4 py-1 font-mono text-[11px] leading-relaxed">
        {preplans.length === 0 && (
          <Row title="No pre-plans yet" subtitle="Click a building to generate a pre-plan." dim />
        )}
        {preplans.slice(0, 3).map((p) => (
          <Row
            key={p.id}
            title={`Pre-plan generated · ${relativeTime(p.created_at)}`}
            subtitle={`${p.building?.address ?? "Unknown"} · Cat ${hurricaneCategory(p.scenario_params?.wind_mph)} scenario`}
          />
        ))}
      </div>
      <div className="whitespace-nowrap border-t border-white/[0.08] px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-white/40">
        {preplanCount} PRE-PLAN{preplanCount === 1 ? "" : "S"} · MIAMI-DADE
      </div>
    </aside>
  );
}

function Row({
  title,
  subtitle,
  pulse,
  dim,
}: {
  title: string;
  subtitle: string;
  pulse?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-2.5">
      <span className="mt-px font-mono text-[#ff6b00]">►</span>
      <div className="flex-1 min-w-0">
        <div
          className={`flex items-center gap-2 truncate ${dim ? "text-white/60" : "text-white/85"}`}
        >
          <span className="truncate">{title}</span>
          {pulse && <LiveDot className="shrink-0" />}
        </div>
        <div className="truncate text-white/40">{subtitle}</div>
      </div>
    </div>
  );
}
