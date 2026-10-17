import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
  SEVERITY_COLOR,
  SEVERITY_HEX,
  SEVERITY_WEIGHT,
  toLocal,
  type EvacExit,
  type EvacRoute,
  type NormPoint,
  type Size3,
} from "@/lib/scan-data";
import type { RiskScore } from "@/lib/types";

export type HazardKind = "wind" | "surge" | "flood";

export type HazardPin = {
  id: string;
  hazard: HazardKind;
  label: string;
  severity: RiskScore;
  anchorDescription: string;
  anchor: NormPoint;
};

const GREEN = 0x22c55e;
const RED = 0xef4444;
const WATER = 0x1e6fd9;

type Disposable = { dispose: () => void };

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function routeLine(points: { x: number; y: number; z: number }[], color: number, opacity: number) {
  const verts = points.map((p) => new THREE.Vector3(p.x, p.y + 0.002, p.z));
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(verts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: 3 }),
  );
}

/** Green/red route polylines plus a ring marker and CSS label per exit. */
export function buildEvacOverlay(routes: EvacRoute[], exits: EvacExit[], size: Size3) {
  const group = new THREE.Group();
  const disposables: Disposable[] = [];
  const labels: HTMLElement[] = [];

  for (const route of routes) {
    if (route.points.length < 2) continue;
    const cut =
      route.status === "partial" && route.blockedFromIndex !== null
        ? Math.max(1, route.blockedFromIndex)
        : route.points.length;

    if (route.status === "open" || route.status === "partial") {
      const pts = route.points.slice(0, cut);
      if (pts.length >= 2) {
        const line = routeLine(pts, GREEN, 0.92);
        group.add(line);
        disposables.push(line.geometry, line.material);
      }
    }
    if (route.status === "blocked" || route.status === "partial") {
      const start = route.status === "blocked" ? 0 : cut - 1;
      const pts = route.points.slice(start);
      if (pts.length >= 2) {
        const line = routeLine(pts, RED, 0.75);
        group.add(line);
        disposables.push(line.geometry, line.material);
      }
    }
  }

  const unit = 0.008 * Math.max(size.x, size.y, size.z);
  for (const exit of exits) {
    const pos = toLocal(exit.anchor, size);
    const marker = new THREE.Group();
    marker.position.set(pos.x, pos.y, pos.z);
    const color = exit.blocked ? RED : GREEN;

    const ringGeo = new THREE.RingGeometry(2 * unit, 3.2 * unit, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: exit.blocked ? 0.85 : 0.7,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    marker.add(ring);
    disposables.push(ringGeo, ringMat);

    if (exit.blocked) {
      // Red "X" across the exit
      const barGeo = new THREE.BoxGeometry(4 * unit, 0.5 * unit, 0.5 * unit);
      const barMat = new THREE.MeshBasicMaterial({ color: RED });
      const a = new THREE.Mesh(barGeo, barMat);
      a.rotation.y = Math.PI / 4;
      const b = new THREE.Mesh(barGeo, barMat);
      b.rotation.y = -Math.PI / 4;
      marker.add(a, b);
      disposables.push(barGeo, barMat);
    } else {
      const dotGeo = new THREE.SphereGeometry(1.2 * unit, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: GREEN });
      marker.add(new THREE.Mesh(dotGeo, dotMat));
      disposables.push(dotGeo, dotMat);
    }

    const el = document.createElement("div");
    el.className = "scan-evac-exit-label";
    el.dataset.blocked = exit.blocked ? "true" : "false";
    el.textContent = exit.blocked ? `${exit.label} · BLOCKED` : exit.label;
    const label = new CSS2DObject(el);
    label.position.set(0, 6 * unit, 0);
    marker.add(label);
    labels.push(el);
    group.add(marker);
  }

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
      for (const el of labels) el.remove();
      group.clear();
    },
  };
}

/** Translucent water plane sized to the mesh footprint at a normalized height. */
export function buildFloodPlane(level: number, size: Size3) {
  const geo = new THREE.PlaneGeometry(1.08 * size.x, 1.08 * size.z);
  const mat = new THREE.MeshBasicMaterial({
    color: WATER,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = (level - 0.5) * size.y;
  mesh.renderOrder = 1;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

function pinElement(pin: HazardPin, opts: { hidden: boolean; animate: boolean }) {
  const el = document.createElement("div");
  el.className = "scan-hazard-pin";
  el.dataset.severity = pin.severity;
  el.dataset.hazard = pin.hazard;
  if (opts.hidden) el.classList.add("scan-hazard-pin--hidden");
  if (opts.animate) el.classList.add("scan-hazard-pin--enter");
  const color = SEVERITY_HEX[pin.severity];
  const text = pin.label.length > 34 ? `${pin.label.slice(0, 33)}…` : pin.label;
  el.innerHTML = `
    <div class="scan-hazard-pin__stack">
      <div class="scan-hazard-pin__label" style="border-color: ${color}40">
        <span class="scan-hazard-pin__hazard" style="color: ${color}">${pin.hazard.toUpperCase()}</span>
        <span class="scan-hazard-pin__text" title="${escapeHtml(pin.label)}">${escapeHtml(text)}</span>
      </div>
      <div class="scan-hazard-pin__stem" style="background: linear-gradient(to bottom, ${color}, transparent)"></div>
      <div class="scan-hazard-pin__dot" style="background: ${color}; box-shadow: 0 0 10px ${color}99"></div>
    </div>
  `;
  return el;
}

/** Severity-colored sphere + halo with a floating CSS label. */
export function buildHazardPin(
  pin: HazardPin,
  pos: { x: number; y: number; z: number },
  size: Size3,
  revealed: boolean,
  animate: boolean,
) {
  const group = new THREE.Group();
  group.position.set(pos.x, pos.y, pos.z);
  const r = 0.006 * Math.max(size.x, size.y, size.z) || 0.012;
  const weight = SEVERITY_WEIGHT[pin.severity] ?? 0.5;

  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 10),
      new THREE.MeshBasicMaterial({
        color: SEVERITY_COLOR[pin.severity],
        transparent: true,
        opacity: 0.95,
      }),
    ),
  );

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.5 * r, 2.3 * r, 24),
    new THREE.MeshBasicMaterial({
      color: SEVERITY_COLOR[pin.severity],
      transparent: true,
      opacity: 0.35 * weight,
      side: THREE.DoubleSide,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);

  const label = new CSS2DObject(pinElement(pin, { hidden: !revealed, animate: revealed && animate }));
  label.position.set(0, 5 * r, 0);
  group.add(label);
  return group;
}
