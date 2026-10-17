"use client";

import { useEffect, useRef } from "react";
import { LiveDot } from "@/components/live-dot";
import { BRAND, BRAND_WORDMARK } from "@/lib/brand";
import { useAgentRun, type AgentEvent } from "./agent-run-provider";

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function summarizeResult(name: string, result: unknown): string {
  if (Array.isArray(result)) {
    if (name === "fetch_street_view") return "image fetched";
    if (name === "fetch_satellite") return "satellite fetched";
    return `${result.length} block${result.length === 1 ? "" : "s"}`;
  }
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (name === "lookup_flood_zone") return `zone: ${r.zone} · bfe: ${r.bfe_ft}ft`;
    if (name === "lookup_surge_zone")
      return `zone: ${r.zone} · priority: ${r.evacuation_order_priority}`;
    if (name === "lookup_nearby" && Array.isArray(r.results)) {
      const results = r.results as { name: string; distance_mi: number }[];
      if (results.length === 0) return "no results";
      const first = results[0];
      const more = results.length > 1 ? ` (+${results.length - 1})` : "";
      return `${first.name} · ${first.distance_mi}mi${more}`;
    }
    return truncate(JSON.stringify(result), 80);
  }
  return truncate(String(result), 80);
}

function EventLine({ ev }: { ev: AgentEvent }) {
  const fade = "aria-fade-in";
  switch (ev.type) {
    case "thinking":
      return (
        <div className={`${fade} mt-3 flex items-center gap-2 text-white/30`}>
          <span>──</span>
          <span className="tracking-wider">iteration {ev.iteration}</span>
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>
      );
    case "reasoning": {
      const text = ev.text
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\s+\n/g, "\n")
        .trim();
      if (!text) return null;
      return <div className={`${fade} whitespace-pre-wrap pl-2 text-white/85`}>{text}</div>;
    }
    case "tool_call": {
      const entries = Object.entries(ev.input);
      return (
        <div className={fade}>
          <div className="text-[#ff6b00]">→ {ev.name}</div>
          <div className="pl-4 text-white/40">
            {entries.length === 0
              ? "—"
              : entries
                  .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                  .join(" · ")}
          </div>
        </div>
      );
    }
    case "tool_result":
      return <div className={`${fade} pl-4 text-white/40`}>✓ {summarizeResult(ev.name, ev.result)}</div>;
    case "complete":
      return (
        <div className={`${fade} mt-3 flex flex-col gap-1 font-medium text-[#ff6b00]`}>
          <span className="h-px w-full bg-[#ff6b00]/40" />
          <span className="tracking-[0.2em]">✓ PRE-INCIDENT PLAN READY</span>
        </div>
      );
    case "error":
      return <div className={`${fade} text-red-400`}>✗ ERROR: {ev.message}</div>;
  }
}

function AgentLog() {
  const { events, running, elapsedMs } = useAgentRun();
  const scrollRef = useRef<HTMLDivElement>(null);
  const complete = events.some((e) => e.type === "complete");
  const iterations = events.filter((e) => e.type === "thinking").length;
  const toolCalls = events.filter((e) => e.type === "tool_call").length;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3 font-mono text-[10px] tracking-[0.3em]">
        <div className="flex items-center gap-2">
          <span className="h-1 w-1 bg-[#ff6b00]" />
          <span className="text-white/70">AGENT · {BRAND_WORDMARK}</span>
        </div>
        {running && (
          <span className="inline-flex items-center gap-2 text-[#ff6b00]">
            <LiveDot />
            RUNNING
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed"
      >
        {events.length === 0 ? (
          <div className="text-white/30">{`> ${BRAND.name.toLowerCase()}.agent ready`}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {events.map((ev, i) => (
              <EventLine key={i} ev={ev} />
            ))}
          </div>
        )}
      </div>
      {complete && !running && (
        <div className="aria-fade-in border-t border-white/[0.08] px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] text-[#ff6b00]">
          ✓ AGENT COMPLETE · {toolCalls} TOOL CALL{toolCalls === 1 ? "" : "S"} · {iterations}{" "}
          ITERATION{iterations === 1 ? "" : "S"}
          {typeof elapsedMs === "number" ? ` · ${Math.max(1, Math.round(elapsedMs / 1000))}s` : ""}
        </div>
      )}
    </div>
  );
}

export function AgentLogPane() {
  const { error } = useAgentRun();
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <div className="min-h-0 flex-1">
        <AgentLog />
      </div>
      {error ? (
        <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-red-400">
          ✗ {error}
        </div>
      ) : null}
    </div>
  );
}
