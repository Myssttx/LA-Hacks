"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Preplan, ScenarioParams } from "@/lib/types";

const AGENT_API_URL = (process.env.NEXT_PUBLIC_AGENT_API_URL ?? "").replace(/\/$/, "");

const DEFAULT_SCENARIO: ScenarioParams = { wind_mph: 130, surge_ft: 6, rainfall_in: 4 };

export type AgentEvent =
  | { type: "thinking"; iteration: number }
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "complete"; report: Preplan }
  | { type: "error"; message: string };

/** "auto" replays a cached run when one exists, otherwise runs live. */
export type RunMode = "auto" | "cached" | "live";
type RunSource = "cached" | "live";

type AgentRunContextValue = {
  events: AgentEvent[];
  report: Preplan | null;
  running: boolean;
  error: string | null;
  source: RunSource | null;
  elapsedMs: number | null;
  address: string;
  buildingId: string | null;
  mode: RunMode;
  setMode: (mode: RunMode) => void;
  run: () => void;
};

const AgentRunContext = createContext<AgentRunContextValue | null>(null);

function parseSseChunk(chunk: string): AgentEvent | null {
  let type = "";
  const data: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!type || data.length === 0) return null;
  try {
    return { type, ...JSON.parse(data.join("\n")) } as AgentEvent;
  } catch {
    return null;
  }
}

function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState<Preplan | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<RunSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      address: string,
      scenario: ScenarioParams,
      opts: { mode?: RunMode; buildingId?: string } = {},
    ) => {
      setEvents([]);
      setReport(null);
      setError(null);
      setSource(null);
      setRunning(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const mode = opts.mode ?? "auto";
      const buildingId = opts.buildingId;

      try {
        let res: Response | null = null;
        let src: RunSource | null = null;

        if (buildingId && (mode === "auto" || mode === "cached")) {
          const replay = await fetch(`${AGENT_API_URL}/agent/replay/${buildingId}`, {
            method: "POST",
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (replay.ok && replay.body) {
            res = replay;
            src = "cached";
          } else if (mode === "cached") {
            throw new Error(`no cached run for this building (HTTP ${replay.status})`);
          }
        }

        if (!res) {
          res = await fetch(`${AGENT_API_URL}/agent/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({ address, scenario_params: scenario, building_id: buildingId }),
            signal: controller.signal,
          });
          src = "live";
          if (!res.ok || !res.body) throw new Error(`Agent request failed: HTTP ${res.status}`);
        }
        setSource(src);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const ev = parseSseChunk(chunk);
            if (!ev) continue;
            setEvents((prev) => [...prev, ev]);
            if (ev.type === "complete") setReport(ev.report);
            if (ev.type === "error") setError(ev.message);
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  return { events, report, running, error, source, run };
}

export function AgentRunProvider({
  address,
  buildingId = null,
  children,
}: {
  address: string;
  buildingId?: string | null;
  children: React.ReactNode;
}) {
  const stream = useAgentStream();
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [mode, setMode] = useState<RunMode>("auto");
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (stream.running && startedAt.current === null) {
      startedAt.current = Date.now();
      setElapsedMs(null);
    } else if (!stream.running && startedAt.current !== null) {
      setElapsedMs(Date.now() - startedAt.current);
      startedAt.current = null;
    }
  }, [stream.running]);

  const value = useMemo<AgentRunContextValue>(
    () => ({
      events: stream.events,
      report: stream.report,
      running: stream.running,
      error: stream.error,
      source: stream.source,
      elapsedMs,
      address,
      buildingId,
      mode,
      setMode,
      run: () => {
        stream.run(address, DEFAULT_SCENARIO, { buildingId: buildingId ?? undefined, mode });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stream.events, stream.report, stream.running, stream.error, stream.source, stream.run, elapsedMs, address, buildingId, mode],
  );

  return <AgentRunContext.Provider value={value}>{children}</AgentRunContext.Provider>;
}

export function useAgentRun() {
  const ctx = useContext(AgentRunContext);
  if (!ctx) throw new Error("useAgentRun must be used within <AgentRunProvider>");
  return ctx;
}
