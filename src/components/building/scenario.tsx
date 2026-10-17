"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { RiskScore } from "@/lib/types";

type ScenarioContextValue = { surge: number; setSurge: (ft: number) => void };

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [surge, setSurge] = useState(0);
  const value = useMemo(() => ({ surge, setSurge }), [surge]);
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used within <ScenarioProvider>");
  return ctx;
}

type Stop = { value: number; label: string };

const SURGE_STOPS: Stop[] = [
  { value: 0, label: "DRY" },
  { value: 1, label: "1FT" },
  { value: 3, label: "3FT" },
  { value: 6, label: "6FT" },
  { value: 10, label: "10FT" },
];

const RISK_PILL: Record<RiskScore, string> = {
  LOW: "bg-white/[0.06] text-white/60",
  MODERATE: "bg-amber-400/15 text-amber-200",
  HIGH: "bg-[#ff6b00]/15 text-[#ffb27a]",
  SEVERE: "bg-red-500/15 text-red-300",
};

function conditions(surge: number) {
  if (surge >= 10) return "CATASTROPHIC FLOODING — RED TAG ZONE";
  if (surge >= 6) return "MAJOR SURGE — STORM CONDITIONS";
  if (surge >= 3) return "MODERATE SURGE — STORM CONDITIONS";
  if (surge >= 1) return "MINOR FLOODING — STORM CONDITIONS";
  return "BASELINE — CLEAR CONDITIONS";
}

export function ScenarioBar({
  surge,
  onSurgeChange,
}: {
  surge: number;
  onSurgeChange: (ft: number) => void;
}) {
  const idx = SURGE_STOPS.findIndex((s) => s.value === surge);
  const risk: RiskScore =
    surge === 0 ? "LOW" : surge === 1 ? "MODERATE" : surge === 10 ? "SEVERE" : "HIGH";
  return (
    <div className="border-t border-[#ff6b00]/30 bg-gradient-to-r from-[#0a0a0a] via-[#080808] to-[#060606]">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-1.5 font-mono text-[10px] tracking-[0.25em]">
        <span className="text-[#ff6b00]/80">SCENARIO</span>
        <span className="text-white/70">{conditions(surge)}</span>
      </div>
      <SteppedSlider
        label="STORM SURGE"
        stops={SURGE_STOPS}
        idx={idx}
        onChange={(i) => onSurgeChange(SURGE_STOPS[i].value)}
        currentLabel={SURGE_STOPS[idx].label}
        risk={risk}
      />
    </div>
  );
}

function SteppedSlider({
  label,
  stops,
  idx,
  onChange,
  currentLabel,
  risk,
}: {
  label: string;
  stops: Stop[];
  idx: number;
  onChange: (i: number) => void;
  currentLabel: string;
  risk: RiskScore;
}) {
  const max = stops.length - 1;
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-28 shrink-0 font-mono text-[10px] tracking-[0.25em] text-[#ff6b00]/80">
        {label}
      </span>
      <div className="flex-1">
        <div className="relative h-4">
          {stops.map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/20"
              style={{ left: `${(i / max) * 100}%` }}
            />
          ))}
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={idx}
            onChange={(e) => onChange(Number(e.target.value))}
            className="aria-range absolute inset-0 w-full"
            aria-label={label}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] tracking-[0.15em] text-white/40">
          {stops.map((s, i) => (
            <span key={s.value} className={i === idx ? "text-[#ff6b00]" : ""}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex w-56 shrink-0 items-center justify-end gap-2 font-mono text-[10px]">
        <span className="text-white/40">CURRENT:</span>
        <span className="text-white">{currentLabel}</span>
        <span className={`rounded-sm px-2 py-0.5 tracking-[0.2em] ${RISK_PILL[risk]}`}>
          RISK: {risk}
        </span>
      </div>
    </div>
  );
}
