"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { BRAND_WORDMARK, COPYRIGHT_NOTICE } from "@/lib/brand";
import { deriveActions, type ActionPriority, type ImmediateAction } from "@/lib/actions";
import type { Hazard, Preplan, RiskScore } from "@/lib/types";
import { useAgentRun } from "./agent-run-provider";

type Dispatched = Record<string, string>;

const RISK_BADGE: Record<RiskScore, string> = {
  LOW: "bg-white/[0.06] text-white/60 border-white/10",
  MODERATE: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  HIGH: "bg-[#ff6b00]/15 text-[#ffb27a] border-[#ff6b00]/40",
  SEVERE: "bg-red-500/15 text-red-300 border-red-500/40",
};

const RISK_TEXT: Record<RiskScore, string> = {
  LOW: "text-white/70",
  MODERATE: "text-amber-200",
  HIGH: "text-[#ffb27a]",
  SEVERE: "text-red-300",
};

const PRIORITY_BAR: Record<ActionPriority, string> = {
  SEVERE: "bg-red-500",
  HIGH: "bg-[#ff6b00]",
  MODERATE: "bg-amber-400",
};

function profileRows(preplan: Preplan): [string, string | number][] {
  const p = preplan.building_profile;
  const c = preplan.context;
  return [
    ["TYPE", p.type],
    ["CONSTRUCTION", p.construction],
    ["HEIGHT", `${p.estimated_height_ft} ft`],
    ["OCCUPANCY", p.estimated_occupancy],
    ["BUILT", p.year_built_estimate],
    ["FLOOD ZONE", c.flood_zone],
    ["SURGE ZONE", c.surge_zone],
    ["HOSPITAL", `${c.nearest_hospital.name} · ${c.nearest_hospital.distance_mi} mi`],
    ["SHELTER", `${c.nearest_shelter.name} · ${c.nearest_shelter.distance_mi} mi`],
  ];
}

export function PreplanReportPanel() {
  const { report, running, run, events } = useAgentRun();
  const started = events.length > 0;
  const [fullscreen, setFullscreen] = useState(false);
  const [dispatched, setDispatched] = useState<Dispatched>({});
  const actions = useMemo(() => (report ? deriveActions(report) : []), [report]);

  const dispatch = (id: string) => {
    const at = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setDispatched((d) => ({ ...d, [id]: at }));
  };

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3 font-mono text-[10px] tracking-[0.3em]">
          <div className="flex items-center gap-2 text-white/70">
            <span className="h-1 w-1 bg-[#ff6b00]" />
            PRE-PLAN REPORT
          </div>
          <div className="flex items-center gap-3">
            <span className={report ? "text-[#ff6b00]" : "text-white/30"}>
              {report ? "COMPLETE" : running ? "STREAMING" : "AWAITING AGENT"}
            </span>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              disabled={!report}
              aria-label="Open fullscreen report"
              className="text-white/40 transition-colors hover:text-[#ff6b00] disabled:cursor-not-allowed disabled:hover:text-white/20"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 border-b border-white/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="w-full rounded-md bg-[#ff6b00] px-3 py-2.5 font-mono text-[11px] font-medium tracking-[0.2em] text-black transition-colors hover:bg-[#ff7f1f] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30"
          >
            {running ? "RUNNING..." : report ? "RE-RUN AGENT" : "RUN PRE-PLAN AGENT"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {report ? (
            <ReportBody
              preplan={report}
              actions={actions}
              dispatched={dispatched}
              onDispatch={dispatch}
            />
          ) : (
            <EmptyState started={started} running={running} />
          )}
        </div>
      </aside>
      {fullscreen && report && (
        <FullscreenReport
          preplan={report}
          actions={actions}
          dispatched={dispatched}
          onDispatch={dispatch}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

function EmptyState({ started, running }: { started: boolean; running: boolean }) {
  const label = running
    ? "AGENT IS THINKING..."
    : started
      ? "FINALIZING REPORT..."
      : "WAITING FOR AGENT OUTPUT...";
  return (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-white/30">
      {label}
    </div>
  );
}

type ActionProps = {
  actions: ImmediateAction[];
  dispatched: Dispatched;
  onDispatch: (id: string) => void;
};

function ReportBody({ preplan, ...actionProps }: { preplan: Preplan } & ActionProps) {
  return (
    <div className="flex flex-col gap-7" style={{ animation: "ariaFadeIn 400ms ease-out" }}>
      <Summary preplan={preplan} />
      <ActionsSection {...actionProps} />
      <ProfileCompact preplan={preplan} />
      <div className="flex flex-col gap-3">
        <HazardCard name="WIND" hazard={preplan.hazards.wind} />
        <HazardCard name="SURGE" hazard={preplan.hazards.surge} />
        <HazardCard name="FLOOD" hazard={preplan.hazards.flood} />
      </div>
    </div>
  );
}

function Summary({ preplan }: { preplan: Preplan }) {
  return (
    <section>
      <div className="mb-2 font-mono text-[10px] tracking-[0.3em] text-[#ff6b00]">HEADLINE RISK</div>
      <p className="text-base font-medium leading-snug text-white">
        {preplan.summary.headline_risk}
      </p>
      <div className="mt-5 mb-2 font-mono text-[10px] tracking-[0.3em] text-white/60">
        30-SECOND SIZE-UP
      </div>
      <p className="text-[13px] leading-relaxed text-white/75">
        {preplan.summary["30_second_size_up"]}
      </p>
    </section>
  );
}

export function ActionsSection({ actions, dispatched, onDispatch }: ActionProps) {
  if (actions.length === 0) return null;
  return (
    <section>
      <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#ff6b00]">
        IMMEDIATE ACTIONS
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <ActionButton
            key={a.id}
            action={a}
            dispatchedAt={dispatched[a.id]}
            onClick={() => onDispatch(a.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ActionButton({
  action,
  dispatchedAt,
  onClick,
}: {
  action: ImmediateAction;
  dispatchedAt?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-dispatched-key={dispatchedAt || ""}
      className={`group relative flex items-stretch gap-3 overflow-hidden rounded-md border border-white/[0.08] bg-black/40 text-left transition-all hover:scale-[1.01] hover:border-[#ff6b00]/40 hover:shadow-[0_0_18px_-4px_rgba(255,107,0,0.45)] ${dispatchedAt ? "ring-1 ring-[#ff6b00]/50" : ""}`}
    >
      <span className={`w-[3px] shrink-0 ${PRIORITY_BAR[action.priority]}`} />
      <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="font-mono text-[11px] font-medium tracking-[0.15em] text-white">
          {action.label}
        </span>
        {dispatchedAt ? (
          <span className="aria-fade-in font-mono text-[10px] tracking-[0.2em] text-[#ff6b00]">
            ✓ DISPATCHED · {dispatchedAt}
          </span>
        ) : (
          <span className="font-mono text-[10px] leading-snug text-white/40">
            {action.sublabel}
          </span>
        )}
      </span>
    </button>
  );
}

function ProfileCompact({ preplan }: { preplan: Preplan }) {
  return (
    <section>
      <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#ff6b00]">
        BUILDING PROFILE
      </div>
      <dl className="flex flex-col gap-1.5 font-mono text-[11px] leading-snug">
        {profileRows(preplan).map(([k, v]) => (
          <div
            key={k}
            className="flex items-start gap-3 border-b border-white/[0.04] pb-1.5 last:border-0"
          >
            <dt className="w-28 shrink-0 tracking-[0.2em] text-[#ff6b00]/70">{k}</dt>
            <dd className="flex-1 text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProfileGrid({ preplan }: { preplan: Preplan }) {
  return (
    <section>
      <div className="mb-3 font-mono text-[11px] tracking-[0.3em] text-[#ff6b00]">
        BUILDING PROFILE
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 font-mono text-[12px] leading-snug sm:grid-cols-2">
        {profileRows(preplan).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 border-b border-white/[0.04] pb-2">
            <dt className="text-[10px] tracking-[0.25em] text-[#ff6b00]/70">{k}</dt>
            <dd className="text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function HazardCard({ name, hazard }: { name: string; hazard: Hazard }) {
  const severe = hazard.risk_score === "SEVERE";
  return (
    <article className="rounded-md border border-white/[0.08] bg-black/40 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-[11px] tracking-[0.3em] text-white/85">{name}</h3>
        <span
          className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] tracking-[0.2em] ${RISK_BADGE[hazard.risk_score]}${severe ? " animate-pulse" : ""}`}
        >
          {hazard.risk_score}
        </span>
      </header>
      <ul className="mb-3 flex flex-col gap-1 font-mono text-[11px] leading-snug">
        {hazard.vulnerable_features.slice(0, 5).map((f, i) => (
          <li key={i} className={`flex gap-2 ${RISK_TEXT[hazard.risk_score]}`}>
            <span className="select-none opacity-60">→</span>
            <span className="flex-1">{f}</span>
          </li>
        ))}
      </ul>
      <p className="italic text-[11px] leading-relaxed text-white/45">
        {hazard.operational_guidance.approach_direction}
        {hazard.operational_guidance.evacuation_priority
          ? ` · ${hazard.operational_guidance.evacuation_priority}`
          : ""}
      </p>
    </article>
  );
}

function FullscreenReport({
  preplan,
  onClose,
  ...actionProps
}: { preplan: Preplan; onClose: () => void } & ActionProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
      onClick={onClose}
      aria-modal
      role="dialog"
      style={{ animation: "ariaFadeIn 200ms ease-out" }}
    >
      <div
        className="relative h-full w-full overflow-y-auto px-12 py-10 lg:px-20 lg:py-14"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fullscreen report"
          className="fixed right-6 top-6 z-10 rounded-md border border-white/[0.08] bg-black/70 p-2 text-white/60 transition-colors hover:border-[#ff6b00]/40 hover:text-[#ff6b00]"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 font-mono text-[11px] tracking-[0.4em] text-[#ff6b00]">
            {BRAND_WORDMARK} · PRE-INCIDENT PLAN
          </div>
          <div className="mb-10 flex items-baseline gap-4 font-mono text-[11px] tracking-[0.25em] text-white/50">
            <span>{preplan.building_profile.address}</span>
            <span className="text-white/20">·</span>
            <span>{preplan.context.flood_zone}</span>
            <span className="text-white/20">·</span>
            <span>{preplan.context.surge_zone}</span>
          </div>

          <section className="mb-12">
            <div className="mb-3 font-mono text-[11px] tracking-[0.3em] text-[#ff6b00]">
              HEADLINE RISK
            </div>
            <h1 className="mb-10 font-mono text-2xl font-medium leading-tight tracking-tight text-white lg:text-3xl">
              {preplan.summary.headline_risk}
            </h1>
            <div className="mb-3 font-mono text-[11px] tracking-[0.3em] text-white/60">
              30-SECOND SIZE-UP
            </div>
            <p className="text-base leading-relaxed text-white/85 lg:text-[17px]">
              {preplan.summary["30_second_size_up"]}
            </p>
          </section>

          <div className="mb-12 grid gap-12 lg:grid-cols-2">
            <div>
              <ActionsSection {...actionProps} />
            </div>
            <div>
              <ProfileGrid preplan={preplan} />
            </div>
          </div>

          <section>
            <div className="mb-4 font-mono text-[11px] tracking-[0.3em] text-[#ff6b00]">
              HAZARD ANALYSIS
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <HazardCard name="WIND" hazard={preplan.hazards.wind} />
              <HazardCard name="SURGE" hazard={preplan.hazards.surge} />
              <HazardCard name="FLOOD" hazard={preplan.hazards.flood} />
            </div>
          </section>

          <footer className="mt-12 border-t border-white/[0.06] pt-6 font-mono text-[10px] tracking-[0.15em] text-white/30">
            {COPYRIGHT_NOTICE}
          </footer>
        </div>
      </div>
    </div>
  );
}
