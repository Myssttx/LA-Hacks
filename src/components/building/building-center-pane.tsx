"use client";

import { LiveDot } from "@/components/live-dot";
import { ScenarioBar, ScenarioProvider, useScenario } from "./scenario";
import { ScanViewer } from "./scan-viewer";

function CenterPane({ buildingId, scanUrl }: { buildingId: string; scanUrl: string | null }) {
  const { surge, setSurge } = useScenario();
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-2.5 font-mono text-[11px] tracking-[0.3em] text-[#ff6b00]">
        <LiveDot />
        3D SCAN
      </div>
      <div className="relative min-h-0 flex-1">
        <ScanViewer buildingId={buildingId} scanUrl={scanUrl} />
      </div>
      <ScenarioBar surge={surge} onSurgeChange={setSurge} />
    </div>
  );
}

export function BuildingCenterPane({
  buildingId,
  scanUrl,
}: {
  buildingId: string;
  scanUrl: string | null;
}) {
  return (
    <ScenarioProvider>
      <CenterPane buildingId={buildingId} scanUrl={scanUrl} />
    </ScenarioProvider>
  );
}
