"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BRAND_WORDMARK } from "@/lib/brand";
import type { Building, PreplanSummary } from "@/lib/types";
import { RecentPreplans } from "./recent-preplans";

type Selection = {
  lngLat: [number, number];
  screen: { x: number; y: number };
  building: Building | null;
};

const CLICKABLE_LAYERS = ["venue-dot", "venue-pulse", "venue-secondary-dot", "building-extrusion"];
// ~50 m in degrees: how close a click must land to snap to a known building.
const SNAP_DEG = 0.0005;

function nearestBuilding(buildings: Building[], [lng, lat]: [number, number]): Building | null {
  let best: { b: Building; d: number } | null = null;
  for (const b of buildings) {
    const dx = lng - b.lng;
    const dy = lat - b.lat;
    if (Math.abs(dx) > SNAP_DEG || Math.abs(dy) > SNAP_DEG) continue;
    const d = dx * dx + dy * dy;
    if (!best || d < best.d) best = { b, d };
  }
  return best?.b ?? null;
}

export function MapDashboard({
  buildings,
  preplans,
  preplanCount,
  mapboxToken,
}: {
  buildings: Building[];
  preplans: PreplanSummary[];
  preplanCount: number;
  mapboxToken: string;
}) {
  const primary = buildings[0] ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pulseFrame = useRef(0);
  const anchorRef = useRef<[number, number] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxToken) return;
    const secondary = buildings.slice(1);

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: primary ? [primary.lng, primary.lat] : [-80.20217163896397, 25.801267443503537],
      zoom: 17,
      pitch: 60,
      bearing: -20,
      antialias: true,
      logoPosition: "top-right",
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.on("error", (e) => {
      console.error("[mapbox-error]", e?.error?.message ?? e);
    });

    const onStyleLoad = () => {
      try {
        if (map.getLayer("building")) map.setLayoutProperty("building", "visibility", "none");
        if (!map.getLayer("building-extrusion")) {
          map.addLayer({
            id: "building-extrusion",
            source: "composite",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "height"],
                0,
                "#2f2f2f",
                40,
                "#3b3b3b",
                120,
                "#4d4d4d",
                250,
                "#5f5f5f",
              ],
              "fill-extrusion-height": ["coalesce", ["get", "height"], 12],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.95,
            },
          });
        }

        if (primary) {
          if (!map.getSource("venue-primary")) {
            map.addSource("venue-primary", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [primary.lng, primary.lat] },
                    properties: { id: primary.id, address: primary.address },
                  },
                ],
              },
            });
          }
          if (!map.getLayer("venue-pulse")) {
            map.addLayer({
              id: "venue-pulse",
              source: "venue-primary",
              type: "circle",
              paint: {
                "circle-radius": 26,
                "circle-color": "#ff6b00",
                "circle-opacity": 0.2,
                "circle-stroke-color": "#ff6b00",
                "circle-stroke-width": 1,
                "circle-stroke-opacity": 0.5,
              },
            });
          }
          if (!map.getLayer("venue-dot")) {
            map.addLayer({
              id: "venue-dot",
              source: "venue-primary",
              type: "circle",
              paint: {
                "circle-radius": 6,
                "circle-color": "#ff6b00",
                "circle-stroke-color": "#000",
                "circle-stroke-width": 2,
              },
            });
          }

          let phase = 0;
          const animate = () => {
            phase = (phase + 0.025) % (2 * Math.PI);
            const t = (Math.sin(phase) + 1) / 2;
            const layer = map.getLayer("venue-pulse");
            if (layer && layer.type === "circle") {
              try {
                map.setPaintProperty("venue-pulse", "circle-radius", 22 + 28 * t);
                map.setPaintProperty("venue-pulse", "circle-opacity", 0.32 - 0.27 * t);
              } catch {}
            }
            pulseFrame.current = requestAnimationFrame(animate);
          };
          pulseFrame.current = requestAnimationFrame(animate);
        }

        if (secondary.length > 0) {
          if (!map.getSource("venue-secondary")) {
            map.addSource("venue-secondary", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: secondary.map((b) => ({
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [b.lng, b.lat] },
                  properties: { id: b.id, address: b.address },
                })),
              },
            });
          }
          if (!map.getLayer("venue-secondary-dot")) {
            map.addLayer({
              id: "venue-secondary-dot",
              source: "venue-secondary",
              type: "circle",
              paint: {
                "circle-radius": 4,
                "circle-color": "#ff6b00",
                "circle-opacity": 0.85,
                "circle-stroke-color": "#000",
                "circle-stroke-width": 1.5,
              },
            });
          }
        }
      } catch (err) {
        console.error("[mapbox-load-handler]", err);
      }
    };
    if (map.isStyleLoaded()) onStyleLoad();
    else map.once("style.load", onStyleLoad);

    map.on("click", (e) => {
      const layers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id));
      const hits = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
      if (hits.length === 0) {
        anchorRef.current = null;
        setSelection(null);
        return;
      }
      const clicked: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const building = nearestBuilding(buildings, clicked);
      const lngLat: [number, number] = building ? [building.lng, building.lat] : clicked;
      const p = map.project(lngLat);
      anchorRef.current = lngLat;
      setSelection({ lngLat, screen: { x: p.x, y: p.y }, building });
    });

    const onMove = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const p = map.project(anchor);
      setSelection((s) => (s ? { ...s, screen: { x: p.x, y: p.y } } : s));
    };
    map.on("move", onMove);

    return () => {
      cancelAnimationFrame(pulseFrame.current);
      map.off("move", onMove);
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, primary, buildings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        anchorRef.current = null;
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    anchorRef.current = null;
    setSelection(null);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      {!mapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-[0.3em] text-white/40">
          SET NEXT_PUBLIC_MAPBOX_TOKEN TO LOAD THE MAP
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-white/[0.08] bg-black/75 px-4 py-2 font-mono text-xs tracking-[0.3em] backdrop-blur">
          <Link href="/" className="text-white transition-colors hover:text-[#ff6b00]">
            {BRAND_WORDMARK}
          </Link>
          <span className="text-white/25">·</span>
          <span className="text-white/60">DASHBOARD</span>
          <span className="text-white/25">·</span>
          <span className="text-white/60">MIAMI-DADE</span>
        </div>
      </div>

      {selection && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: selection.screen.x,
            top: selection.screen.y,
            transform: "translate(-50%, calc(-100% - 22px))",
          }}
        >
          <div className="pointer-events-auto relative w-72 rounded-md border border-white/[0.1] bg-black/95 p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.3em] text-white/40">
                BUILDING · {selection.lngLat[1].toFixed(4)}, {selection.lngLat[0].toFixed(4)}
              </span>
              <button
                onClick={close}
                aria-label="Close"
                className="font-mono text-base leading-none text-white/40 transition-colors hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="mb-4 text-sm font-medium leading-snug text-white">
              {selection.building?.address ?? "UNKNOWN STRUCTURE"}
            </div>
            {selection.building ? (
              <Link
                href={`/building/${selection.building.id}`}
                className="group/cta inline-flex w-full items-center justify-between rounded-sm bg-[#ff6b00] px-3 py-2 font-mono text-[11px] font-medium tracking-[0.2em] text-black transition-colors hover:bg-[#ff7f1f]"
              >
                VIEW BUILDING
                <span aria-hidden className="transition-transform group-hover/cta:translate-x-0.5">
                  →
                </span>
              </Link>
            ) : (
              <div className="inline-flex w-full items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-white/30">
                PRE-PLAN PENDING
                <span aria-hidden>—</span>
              </div>
            )}
            <div className="absolute left-1/2 top-full -translate-x-1/2">
              <div className="h-0 w-0 border-x-[8px] border-t-[8px] border-x-transparent border-t-black/95" />
            </div>
          </div>
        </div>
      )}

      <RecentPreplans preplans={preplans} preplanCount={preplanCount} />
    </main>
  );
}
