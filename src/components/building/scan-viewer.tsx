"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { USDLoader } from "three/addons/loaders/USDLoader.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  SCAN_URLS,
  computeEvacPlan,
  floodLevel,
  hasEvacPlan,
  openExitCount,
  resolveAnchor,
  toLocal,
  type EvacPlan,
  type Size3,
} from "@/lib/scan-data";
import { useAgentRun } from "./agent-run-provider";
import { useScenario } from "./scenario";
import {
  buildEvacOverlay,
  buildFloodPlane,
  buildHazardPin,
  type HazardKind,
  type HazardPin,
} from "./scan-scene";

type ViewMode = "default" | "evac" | "hazards";
type HazardFilter = "all" | HazardKind;

type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  controls: OrbitControls;
  pinRoot: THREE.Group;
  evacRoot: THREE.Group;
  floodRoot: THREE.Group;
  meshSize: THREE.Vector3;
  dispose: () => void;
};

type Overlay = { dispose: () => void };
type FloodOverlay = Overlay & { mesh: THREE.Mesh };

const PIN_REVEAL_MS = 180;

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "default", label: "MESH" },
  { id: "evac", label: "EVAC" },
  { id: "hazards", label: "HAZARDS" },
];

const HAZARD_FILTERS: { id: HazardFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "wind", label: "WIND" },
  { id: "surge", label: "SURGE" },
  { id: "flood", label: "FLOOD" },
];

function size3(v: THREE.Vector3) {
  return { x: v.x, y: v.y, z: v.z };
}

export function ScanViewer({ buildingId, scanUrl }: { buildingId: string; scanUrl: string | null }) {
  const url = SCAN_URLS[buildingId] ?? scanUrl ?? null;
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const pinObjects = useRef<THREE.Object3D[]>([]);
  const evacOverlay = useRef<Overlay | null>(null);
  const floodOverlay = useRef<FloodOverlay | null>(null);
  const animatedPins = useRef<Set<string>>(new Set());
  const modeRef = useRef<ViewMode>("default");
  const floodTarget = useRef<number | null>(null);

  const { report, running } = useAgentRun();
  const { surge } = useScenario();

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [vertexCount, setVertexCount] = useState<number | null>(null);
  const [filter, setFilter] = useState<HazardFilter>("all");
  const [revealed, setRevealed] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const [meshSize, setMeshSize] = useState<Size3 | null>(null);
  const [mode, setMode] = useState<ViewMode>(() => (hasEvacPlan(buildingId) ? "evac" : "default"));

  const pins = useMemo<HazardPin[]>(() => {
    if (!report) return [];
    const out: HazardPin[] = [];
    let n = 0;
    for (const hazard of ["wind", "surge", "flood"] as const) {
      report.hazards[hazard].annotations_3d.forEach((a, i) => {
        out.push({
          id: `${hazard}-${i}-${n}`,
          hazard,
          label: a.label,
          severity: a.severity,
          anchorDescription: a.anchor_description,
          anchor: resolveAnchor(`${a.anchor_description} ${a.label}`, buildingId, n),
        });
        n += 1;
      });
    }
    return out;
  }, [report, buildingId]);

  const counts = useMemo(
    () => ({
      all: pins.length,
      wind: pins.filter((p) => p.hazard === "wind").length,
      surge: pins.filter((p) => p.hazard === "surge").length,
      flood: pins.filter((p) => p.hazard === "flood").length,
    }),
    [pins],
  );

  const visiblePins = useMemo(
    () => (filter === "all" ? pins : pins.filter((p) => p.hazard === filter)),
    [pins, filter],
  );

  const evacPlan = useMemo<EvacPlan | null>(() => {
    if (!loaded || !meshSize || !hasEvacPlan(buildingId)) return null;
    return computeEvacPlan(buildingId, surge, meshSize);
  }, [buildingId, surge, loaded, meshSize]);

  const waterLevel = useMemo(() => floodLevel(buildingId, surge), [buildingId, surge]);

  // The render loop reads these outside React.
  useEffect(() => {
    modeRef.current = mode;
    floodTarget.current = waterLevel;
  }, [mode, waterLevel]);

  const hasPins = !!report && pins.length > 0;
  const revealedCount = hasPins ? revealed : 0;
  const pinsIndexing = hasPins && indexing;

  // Reveal hazard pins one at a time once a report lands.
  useEffect(() => {
    if (!report || pins.length === 0) return;
    animatedPins.current = new Set();
    /* eslint-disable react-hooks/set-state-in-effect -- kick off the staggered reveal */
    setRevealed(1);
    setIndexing(pins.length > 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (pins.length <= 1) return;
    let count = 1;
    const timer = window.setInterval(() => {
      count += 1;
      setRevealed(count);
      if (count >= pins.length) {
        setIndexing(false);
        window.clearInterval(timer);
      }
    }, PIN_REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [report, pins.length]);

  // Scene setup + scan load.
  useEffect(() => {
    if (!url) return;
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let frame = 0;
    let teardown: (() => void) | null = null;

    (async () => {
      const width = mount.clientWidth || 400;
      const height = mount.clientHeight || 230;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 500);
      camera.position.set(0, 0.4, 2.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      mount.appendChild(renderer.domElement);

      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(width, height);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.inset = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      mount.appendChild(labelRenderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 4, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.9);
      fill.position.set(-3, 2, -3);
      scene.add(fill);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        setInteracted(true);
      });

      const pinRoot = new THREE.Group();
      const evacRoot = new THREE.Group();
      const floodRoot = new THREE.Group();
      scene.add(floodRoot, evacRoot, pinRoot);

      const isGltf = /\.(glb|gltf)(\?|$)/i.test(url);
      let resizeObserver: ResizeObserver | null = null;
      try {
        const model = isGltf
          ? (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url)).scene
          : await new USDLoader().loadAsync(url);
        if (cancelled) return;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        scene.add(model);

        // Frame the model.
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fov = (camera.fov * Math.PI) / 180;
        const aspect = mount.clientWidth / mount.clientHeight;
        const fit = maxDim / (2 * Math.tan(fov / 2));
        const dist = 1.15 * Math.max(fit, fit / aspect);
        const dir = new THREE.Vector3(0.55, 0.4, 1).normalize();
        camera.position.copy(dir.multiplyScalar(dist));
        camera.near = Math.max(0.001, dist / 500);
        camera.far = 50 * dist;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.minDistance = 0.3 * dist;
        controls.maxDistance = 4 * dist;
        controls.update();

        let verts = 0;
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) verts += mesh.geometry?.attributes?.position?.count ?? 0;
        });
        setVertexCount(verts);
        setMeshSize(size3(size));
        setLoaded(true);

        sceneRef.current = {
          scene,
          camera,
          renderer,
          labelRenderer,
          controls,
          pinRoot,
          evacRoot,
          floodRoot,
          meshSize: size.clone(),
          dispose: () => {
            cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            evacOverlay.current?.dispose();
            floodOverlay.current?.dispose();
            controls.dispose();
            renderer.dispose();
            pinRoot.clear();
            evacRoot.clear();
            floodRoot.clear();
            scene.clear();
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
            if (labelRenderer.domElement.parentNode === mount)
              mount.removeChild(labelRenderer.domElement);
          },
        };
      } catch (err) {
        console.error("[building-scan] USDZ load failed", err);
        if (!cancelled) setFailed(true);
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        if (labelRenderer.domElement.parentNode === mount)
          mount.removeChild(labelRenderer.domElement);
        return;
      }

      resizeObserver = new ResizeObserver(() => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
      });
      resizeObserver.observe(mount);

      const tick = () => {
        controls.update();
        // Ease the water plane toward the current surge height.
        const handle = sceneRef.current;
        if (floodOverlay.current && floodTarget.current !== null && modeRef.current === "evac" && handle) {
          const target = (floodTarget.current - 0.5) * handle.meshSize.y;
          const water = floodOverlay.current.mesh;
          water.position.y = THREE.MathUtils.lerp(water.position.y, target, 0.12);
        }
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
      };
      tick();

      teardown = () => {
        sceneRef.current?.dispose();
        sceneRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      teardown?.();
      pinObjects.current = [];
      evacOverlay.current = null;
      floodOverlay.current = null;
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
  }, [url]);

  // Evac routes + exits.
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle || !loaded || mode !== "evac") {
      evacOverlay.current?.dispose();
      evacOverlay.current = null;
      handle?.evacRoot.clear();
      return;
    }
    const size = size3(handle.meshSize);
    const plan = computeEvacPlan(buildingId, surge, size);
    if (!plan) return;
    evacOverlay.current?.dispose();
    handle.evacRoot.clear();
    const overlay = buildEvacOverlay(plan.routes, plan.exits, size);
    handle.evacRoot.add(overlay.group);
    evacOverlay.current = overlay;
  }, [buildingId, surge, loaded, mode]);

  // Flood plane.
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle || !loaded || mode !== "evac") {
      floodOverlay.current?.dispose();
      floodOverlay.current = null;
      handle?.floodRoot.clear();
      return;
    }
    floodOverlay.current?.dispose();
    handle.floodRoot.clear();
    if (waterLevel === null) return;
    const plane = buildFloodPlane(waterLevel, size3(handle.meshSize));
    handle.floodRoot.add(plane.mesh);
    floodOverlay.current = plane;
  }, [buildingId, surge, waterLevel, loaded, mode]);

  // Hazard pins.
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle || !loaded) return;
    for (const obj of pinObjects.current) {
      handle.pinRoot.remove(obj);
      obj.traverse((o) => {
        // CSS2DObject only cleans up its element when removed directly, not via a parent.
        if (o instanceof CSS2DObject) o.element.remove();
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    }
    pinObjects.current = [];
    if (mode !== "hazards" || !report || pins.length === 0) return;

    const shown = new Set(pins.slice(0, revealedCount).map((p) => p.id));
    const size = size3(handle.meshSize);
    visiblePins.forEach((pin) => {
      const isRevealed = shown.has(pin.id);
      const animate = isRevealed && !animatedPins.current.has(pin.id);
      if (animate) animatedPins.current.add(pin.id);
      const obj = buildHazardPin(pin, toLocal(pin.anchor, size), size, isRevealed, animate);
      handle.pinRoot.add(obj);
      pinObjects.current.push(obj);
    });
  }, [loaded, report, pins, visiblePins, revealedCount, mode]);

  const status =
    pins.length > 0 && mode === "hazards"
      ? `${pins.length} HAZARD PIN${pins.length === 1 ? "" : "S"}`
      : running
        ? "AGENT RUNNING"
        : null;
  const exitsOpen = evacPlan ? openExitCount(evacPlan) : 0;
  const exitsTotal = evacPlan?.exits.length ?? 0;

  if (!url) {
    return (
      <section className="relative flex h-full flex-col gap-2 bg-[#0a0a0a] p-3">
        <div className="flex flex-1 items-center justify-center rounded-sm border border-red-500/30 bg-black/60 p-6 text-center font-mono text-[10px] leading-relaxed tracking-[0.2em]">
          <div>
            <p className="text-red-300/90">NO LIDAR SCAN · WRONG BUILDING ID</p>
            <p className="mt-3 text-white/40">
              git pull origin main
              <br />
              run infra/supabase/migrations/0003_the_dock.sql
              <br />
              open The Dock from dashboard
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex h-full flex-col gap-2 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.3em]">
        <div className="flex items-center gap-2 text-[#ff6b00]/80">
          <span className="h-1 w-1 bg-[#ff6b00]" />
          3D SCAN · LIDAR CAPTURE
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className={pins.length > 0 ? "text-[#ffb27a]" : "animate-pulse text-white/40"}>
              {status}
            </span>
          )}
          {mode === "evac" && evacPlan && (
            <span className="text-emerald-300/90">
              EVAC · {exitsOpen}/{exitsTotal} OPEN
            </span>
          )}
          <span className="text-white/30">{failed ? "PROCESSING" : loaded ? "READY" : "LOADING"}</span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-[#ff6b00]/20 bg-black/60">
        <div
          ref={mountRef}
          className="absolute inset-0"
          style={{ transition: "opacity 400ms ease-out", opacity: loaded ? 1 : 0 }}
        />
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-[0.3em] text-white/30">
            DECODING SCAN…
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-[0.3em] text-white/40">
            SCAN PROCESSING…
          </div>
        )}
        {loaded && !failed && (
          <ModeToggle
            mode={mode}
            onModeChange={setMode}
            buildingId={buildingId}
            evacOpenCount={exitsOpen}
            evacTotal={exitsTotal}
            surgeActive={surge > 0}
          />
        )}
        {loaded && !failed && mode === "hazards" && pins.length > 0 && (
          <HazardFilterBar
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            indexing={pinsIndexing}
          />
        )}
        {loaded && !failed && (
          <ScanStats
            vertexCount={vertexCount}
            pinCount={mode === "hazards" ? pins.length : 0}
            revealedCount={revealedCount}
            evacPlan={mode === "evac" ? evacPlan : null}
            surge={surge}
          />
        )}
        {loaded && !interacted && !failed && (
          <div className="pointer-events-none absolute bottom-3 right-4 font-mono text-[9px] tracking-[0.3em] text-white/40">
            DRAG TO ROTATE · SCROLL TO ZOOM
          </div>
        )}
      </div>
    </section>
  );
}

const TOGGLE_BASE = "rounded-sm font-mono text-[9px] tracking-[0.15em] transition-colors ";
const toggleClass = (active: boolean, disabled: boolean) =>
  active
    ? "bg-[#ff6b00]/20 text-[#ff6b00]"
    : disabled
      ? "cursor-not-allowed text-white/20"
      : "text-white/45 hover:bg-white/[0.06] hover:text-white/80";

function ModeToggle({
  mode,
  onModeChange,
  buildingId,
  evacOpenCount,
  evacTotal,
  surgeActive,
}: {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  buildingId: string;
  evacOpenCount: number;
  evacTotal: number;
  surgeActive: boolean;
}) {
  const evacAvailable = hasEvacPlan(buildingId);
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-col gap-2">
      <div
        className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-black/80 p-1 backdrop-blur"
        role="group"
        aria-label="3D scan view mode"
      >
        {VIEW_MODES.map(({ id, label }) => {
          const disabled = id === "evac" && !evacAvailable;
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onModeChange(id)}
              className={`${TOGGLE_BASE}px-2.5 py-1 ${toggleClass(active, disabled)}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {mode === "evac" && evacAvailable && (
        <div className="rounded-md border border-white/[0.08] bg-black/80 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.12em] backdrop-blur">
          <span className={evacOpenCount === 0 ? "text-red-300" : "text-emerald-300"}>
            {evacOpenCount}/{evacTotal} EXITS OPEN
          </span>
          {surgeActive && <span className="ml-2 text-[#ffb27a]">· SURGE ACTIVE</span>}
        </div>
      )}
    </div>
  );
}

function HazardFilterBar({
  filter,
  onFilterChange,
  counts,
  indexing,
}: {
  filter: HazardFilter;
  onFilterChange: (f: HazardFilter) => void;
  counts: Record<HazardFilter, number>;
  indexing: boolean;
}) {
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
      {indexing && (
        <div className="flex items-center gap-2 rounded-md border border-[#ff6b00]/30 bg-black/80 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.2em] text-[#ffb27a] backdrop-blur">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b00] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff6b00]" />
          </span>
          INDEXING HAZARDS…
        </div>
      )}
      <div
        className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-black/80 p-1 backdrop-blur"
        role="group"
        aria-label="Filter hazard pins"
      >
        {HAZARD_FILTERS.map(({ id, label }) => {
          const count = counts[id];
          const active = filter === id;
          const disabled = count === 0 && id !== "all";
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onFilterChange(id)}
              className={`${TOGGLE_BASE}px-2 py-1 ${toggleClass(active, disabled)}`}
            >
              {label}
              {count > 0 && (
                <span className={active ? " text-[#ffb27a]" : " text-white/30"}> · {count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScanStats({
  vertexCount,
  pinCount,
  revealedCount,
  evacPlan,
  surge,
}: {
  vertexCount: number | null;
  pinCount: number;
  revealedCount: number;
  evacPlan: EvacPlan | null;
  surge: number;
}) {
  const mesh = vertexCount
    ? vertexCount >= 1e6
      ? `${(vertexCount / 1e6).toFixed(1)}M VERTICES`
      : `${Math.round(vertexCount / 1e3)}K VERTICES`
    : "180K VERTICES";
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 max-w-[280px] rounded-md border border-white/[0.08] bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed backdrop-blur">
      <StatRow label="CAPTURE" value="PHONE LIDAR · 5 MIN" />
      <StatRow label="MESH" value={mesh} />
      {pinCount > 0 && (
        <StatRow label="HAZARDS" value={`${Math.min(revealedCount, pinCount)}/${pinCount} INDEXED`} />
      )}
      {evacPlan && (
        <>
          <StatRow label="EVAC" value={`${openExitCount(evacPlan)}/${evacPlan.exits.length} EXITS`} />
          {surge > 0 && <StatRow label="SURGE" value={`${surge} FT · WATER ACTIVE`} />}
        </>
      )}
      <StatRow label="ACCURACY" value="±5CM" />
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 whitespace-nowrap">
      <span className="w-20 shrink-0 tracking-[0.2em] text-[#ff6b00]/70">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  );
}
