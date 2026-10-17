// Per-building calibration for the LiDAR scans: normalized anchor points
// (0..1 of the mesh bounding box), evac exits/routes, and flood-plane heights.

import type { RiskScore } from "./types";

export type NormPoint = { nx: number; ny: number; nz: number };
export type Size3 = { x: number; y: number; z: number };

export const BUILDING_A = "014b39a9-09b8-432b-9b62-363e06383d1f";
export const BUILDING_B = "870d979d-6eaf-4d7f-894a-8ca34e527237";
export const THE_DOCK = "e5a3fddc-e22c-431c-a5d3-ee29ef8604d1";

/** Map a normalized point into mesh-local coordinates (mesh is centered at origin). */
export function toLocal(p: NormPoint, size: Size3) {
  return { x: (p.nx - 0.5) * size.x, y: (p.ny - 0.5) * size.y, z: (p.nz - 0.5) * size.z };
}

/** Floor-plan helper: (x, depth, height) → normalized point. */
function fp(nx: number, nz: number, ny: number): NormPoint {
  return { nx, ny, nz };
}

type AnchorKey = "roof" | "hvac" | "ground_egress" | "glass_facade" | "interior" | "open_court";

export const ANCHORS: Record<string, Record<AnchorKey, NormPoint>> = {
  [THE_DOCK]: {
    roof: { nx: 0.35, ny: 0.9, nz: 0.35 },
    hvac: { nx: 0.5, ny: 0.85, nz: 0.45 },
    ground_egress: { nx: 0.45, ny: 0.06, nz: 0.12 },
    glass_facade: { nx: 0.45, ny: 0.4, nz: 0.1 },
    interior: { nx: 0.35, ny: 0.4, nz: 0.4 },
    open_court: { nx: 0.3, ny: 0.06, nz: 0.9 },
  },
  [BUILDING_A]: {
    roof: { nx: 0.52, ny: 0.94, nz: 0.48 },
    hvac: { nx: 0.64, ny: 0.9, nz: 0.4 },
    ground_egress: { nx: 0.46, ny: 0.06, nz: 0.74 },
    glass_facade: { nx: 0.84, ny: 0.38, nz: 0.58 },
    interior: { nx: 0.5, ny: 0.52, nz: 0.5 },
    open_court: { nx: 0.28, ny: 0.1, nz: 0.22 },
  },
  [BUILDING_B]: {
    roof: { nx: 0.5, ny: 0.93, nz: 0.42 },
    hvac: { nx: 0.58, ny: 0.88, nz: 0.35 },
    ground_egress: { nx: 0.44, ny: 0.05, nz: 0.68 },
    glass_facade: { nx: 0.78, ny: 0.4, nz: 0.62 },
    interior: { nx: 0.5, ny: 0.48, nz: 0.52 },
    open_court: { nx: 0.22, ny: 0.12, nz: 0.78 },
  },
};

/** Fallback anchors used round-robin when a description matches nothing. */
export const GENERIC_ANCHORS: NormPoint[] = [
  { nx: 0.5, ny: 0.92, nz: 0.5 },
  { nx: 0.18, ny: 0.14, nz: 0.72 },
  { nx: 0.82, ny: 0.22, nz: 0.38 },
  { nx: 0.35, ny: 0.55, nz: 0.18 },
  { nx: 0.68, ny: 0.62, nz: 0.84 },
  { nx: 0.5, ny: 0.35, nz: 0.5 },
  { nx: 0.12, ny: 0.48, nz: 0.5 },
  { nx: 0.88, ny: 0.5, nz: 0.5 },
];

export const SEVERITY_HEX: Record<RiskScore, string> = {
  LOW: "#d1d5db",
  MODERATE: "#fbbf24",
  HIGH: "#ff6b00",
  SEVERE: "#ef4444",
};

export const SEVERITY_COLOR: Record<RiskScore, number> = {
  LOW: 0xd1d5db,
  MODERATE: 0xfbbf24,
  HIGH: 0xff6b00,
  SEVERE: 0xef4444,
};

export const SEVERITY_WEIGHT: Record<RiskScore, number> = {
  LOW: 0.35,
  MODERATE: 0.55,
  HIGH: 0.75,
  SEVERE: 1,
};

/** Pick a mesh anchor for an annotation from keywords in its description. */
export function resolveAnchor(text: string, buildingId: string, index: number): NormPoint {
  const a = ANCHORS[buildingId];
  const t = text.toLowerCase();
  if (/roof|parapet|mechanical|hvac|unit|canopy|ridge/.test(t))
    return a?.hvac && /hvac|mechanical|unit/.test(t) ? a.hvac : (a?.roof ?? GENERIC_ANCHORS[0]);
  if (/ground|egress|entry|door|threshold|grade|floor|ingress|exit/.test(t))
    return a?.ground_egress ?? GENERIC_ANCHORS[1];
  if (/glass|facade|window|curtain|storefront|glazing/.test(t))
    return a?.glass_facade ?? GENERIC_ANCHORS[2];
  if (/court|playground|basketball|assembly|exterior open|outside/.test(t))
    return a?.open_court ?? GENERIC_ANCHORS[3];
  if (/interior|room|hall|auditorium|classroom|ceiling|span|concourse/.test(t))
    return a?.interior ?? GENERIC_ANCHORS[4];
  if (/west/.test(t)) return { nx: 0.06, ny: 0.52, nz: 0.5 };
  if (/east/.test(t)) return { nx: 0.94, ny: 0.52, nz: 0.5 };
  if (/north/.test(t)) return { nx: 0.5, ny: 0.5, nz: 0.06 };
  if (/south/.test(t)) return { nx: 0.5, ny: 0.5, nz: 0.94 };
  return GENERIC_ANCHORS[index % GENERIC_ANCHORS.length];
}

// --- Evacuation ----------------------------------------------------------

const VIEWPOINTS: Record<string, Record<string, NormPoint>> = {
  [THE_DOCK]: {
    bay_entrance: fp(0.45, 0.12, 0.05),
    bay_main: fp(0.4, 0.26, 0.05),
    bay_center: fp(0.35, 0.4, 0.05),
    bay_rear: fp(0.3, 0.54, 0.05),
    side_north: fp(0.12, 0.42, 0.05),
    dock_threshold: fp(0.28, 0.66, 0.05),
    street_assembly: fp(0.3, 0.9, 0.04),
  },
  [BUILDING_A]: {
    hall_start: fp(0.46, 0.76, 0.09),
    hall_concourse: fp(0.5, 0.58, 0.09),
    hall_corner: fp(0.4, 0.42, 0.09),
    exit_outside: fp(0.44, 0.26, 0.06),
    yard_open: fp(0.32, 0.16, 0.05),
    court_play: fp(0.26, 0.06, 0.04),
  },
  [BUILDING_B]: {
    exterior_approach: fp(0.42, 0.74, 0.05),
    entry_door_a: fp(0.44, 0.6, 0.06),
    entry_door_b: fp(0.5, 0.5, 0.07),
    interior_main: fp(0.48, 0.38, 0.08),
    interior_open: fp(0.46, 0.28, 0.08),
    interior_rear: fp(0.54, 0.18, 0.08),
    interior_workstation: fp(0.58, 0.1, 0.09),
  },
};

type ExitDef = {
  id: string;
  label: string;
  viewpointId: string;
  anchor: NormPoint;
  /** Surge depth (ft) at which this exit floods; null = never blocked. */
  blockedAtSurgeFt: number | null;
  source: string;
};

type RouteDef = {
  id: string;
  label: string;
  waypointViewpoints: string[];
  targetExitId: string;
  source: string;
};

type EvacConfig = {
  calibrationSource: string;
  assemblyExitId: string;
  exits: ExitDef[];
  routes: RouteDef[];
};

const EVAC: Record<string, EvacConfig> = {
  [THE_DOCK]: {
    calibrationSource: "LiDAR scan · The Dock open-bay capture · single-story 26×38 m",
    assemblyExitId: "exit_assembly_street",
    exits: [
      {
        id: "exit_main_bay",
        label: "MAIN BAY DOOR",
        viewpointId: "bay_entrance",
        anchor: fp(0.45, 0.12, 0.05),
        blockedAtSurgeFt: 1,
        source: "annotation: GRADE-LEVEL ROLL-UP · SURGE ENTRY",
      },
      {
        id: "exit_loading_dock",
        label: "LOADING DOCK",
        viewpointId: "bay_main",
        anchor: fp(0.58, 0.3, 0.05),
        blockedAtSurgeFt: 3,
        source: "annotation: SIDE LOADING DOCK · SECONDARY EGRESS",
      },
      {
        id: "exit_side_north",
        label: "NORTH SIDE EGRESS",
        viewpointId: "side_north",
        anchor: fp(0.1, 0.42, 0.05),
        blockedAtSurgeFt: 6,
        source: "annotation: PERSONNEL DOOR · RAISED THRESHOLD",
      },
      {
        id: "exit_dock_threshold",
        label: "DOCK THRESHOLD",
        viewpointId: "dock_threshold",
        anchor: fp(0.28, 0.66, 0.05),
        blockedAtSurgeFt: 3,
        source: "annotation: REAR THRESHOLD · LOW GRADE",
      },
      {
        id: "exit_assembly_street",
        label: "ASSEMBLY · STREET",
        viewpointId: "street_assembly",
        anchor: fp(0.3, 0.9, 0.04),
        blockedAtSurgeFt: null,
        source: "annotation: NW 26TH ST · EVAC ASSEMBLY POINT",
      },
    ],
    routes: [
      {
        id: "primary_to_street",
        label: "PRIMARY · BAY TO STREET",
        waypointViewpoints: [
          "bay_entrance",
          "bay_main",
          "bay_center",
          "bay_rear",
          "dock_threshold",
          "street_assembly",
        ],
        targetExitId: "exit_assembly_street",
        source: "walkthrough_navigation",
      },
      {
        id: "alternate_side",
        label: "ALTERNATE · NORTH SIDE EGRESS",
        waypointViewpoints: ["bay_center", "side_north"],
        targetExitId: "exit_side_north",
        source: "walkthrough_navigation",
      },
      {
        id: "staging_dock",
        label: "STAGING · LOADING DOCK",
        waypointViewpoints: ["bay_entrance", "bay_main"],
        targetExitId: "exit_loading_dock",
        source: "walkthrough_navigation",
      },
    ],
  },
  [BUILDING_A]: {
    calibrationSource: "LiDAR walkthrough graph · Miami Senior High hall capture · 6 viewpoints",
    assemblyExitId: "exit_assembly_court",
    exits: [
      {
        id: "exit_hall_ingress",
        label: "HALL INGRESS",
        viewpointId: "hall_start",
        anchor: fp(0.46, 0.76, 0.06),
        blockedAtSurgeFt: 3,
        source: "annotation: GROUND-LEVEL EGRESS · SURGE ENTRY",
      },
      {
        id: "exit_auditorium",
        label: "AUDITORIUM EXIT",
        viewpointId: "hall_concourse",
        anchor: fp(0.5, 0.58, 0.08),
        blockedAtSurgeFt: 3,
        source: "annotation: AUDITORIUM EXIT · PRIMARY EVAC",
      },
      {
        id: "exit_grade_transition",
        label: "GRADE TRANSITION",
        viewpointId: "exit_outside",
        anchor: fp(0.44, 0.26, 0.05),
        blockedAtSurgeFt: 1,
        source: "annotation: GRADE-LEVEL THRESHOLD · SURGE INTRUSION",
      },
      {
        id: "exit_yard",
        label: "YARD EGRESS",
        viewpointId: "yard_open",
        anchor: fp(0.32, 0.16, 0.04),
        blockedAtSurgeFt: 6,
        source: "annotation: LOW-LYING DRAINAGE · STANDING WATER",
      },
      {
        id: "exit_assembly_court",
        label: "ASSEMBLY · COURT",
        viewpointId: "court_play",
        anchor: fp(0.26, 0.06, 0.03),
        blockedAtSurgeFt: null,
        source: "annotation: OPEN COURT · EVAC ASSEMBLY POINT",
      },
    ],
    routes: [
      {
        id: "primary_to_assembly",
        label: "PRIMARY · INTERIOR TO COURT",
        waypointViewpoints: [
          "hall_start",
          "hall_concourse",
          "hall_corner",
          "exit_outside",
          "yard_open",
          "court_play",
        ],
        targetExitId: "exit_assembly_court",
        source: "walkthrough_navigation",
      },
      {
        id: "interior_shelter",
        label: "ALTERNATE · INTERIOR SHELTER",
        waypointViewpoints: ["hall_start", "hall_concourse", "hall_corner"],
        targetExitId: "exit_auditorium",
        source: "walkthrough_navigation",
      },
    ],
  },
  [BUILDING_B]: {
    calibrationSource: "LiDAR walkthrough graph · Innovation Center capture · 7 viewpoints",
    assemblyExitId: "exit_side_egress",
    exits: [
      {
        id: "exit_main_facade",
        label: "MAIN FACADE",
        viewpointId: "exterior_approach",
        anchor: fp(0.42, 0.74, 0.04),
        blockedAtSurgeFt: 1,
        source: "annotation: GRADE-LEVEL ENTRY · SURGE EXPOSURE",
      },
      {
        id: "exit_glass_vestibule",
        label: "GLASS VESTIBULE",
        viewpointId: "entry_door_a",
        anchor: fp(0.44, 0.6, 0.05),
        blockedAtSurgeFt: 1,
        source: "annotation: GLASS DOOR · IMPACT NOT RATED",
      },
      {
        id: "exit_side_egress",
        label: "SIDE EGRESS",
        viewpointId: "entry_door_b",
        anchor: fp(0.5, 0.5, 0.06),
        blockedAtSurgeFt: 3,
        source: "annotation: SECONDARY EGRESS · UNOBSTRUCTED",
      },
      {
        id: "exit_rear",
        label: "REAR WORKSTATION",
        viewpointId: "interior_workstation",
        anchor: fp(0.58, 0.1, 0.08),
        blockedAtSurgeFt: 6,
        source: "walkthrough: interior rear capture",
      },
    ],
    routes: [
      {
        id: "interior_to_side",
        label: "PRIMARY · INTERIOR TO SIDE DOOR",
        waypointViewpoints: ["interior_main", "interior_open", "interior_rear", "entry_door_b"],
        targetExitId: "exit_side_egress",
        source: "walkthrough_navigation",
      },
      {
        id: "interior_shelter_in_place",
        label: "ALTERNATE · SHELTER IN PLACE",
        waypointViewpoints: ["interior_main", "interior_open"],
        targetExitId: "exit_rear",
        source: "walkthrough_navigation",
      },
      {
        id: "front_approach",
        label: "STAGING · FRONT APPROACH",
        waypointViewpoints: ["exterior_approach", "entry_door_a"],
        targetExitId: "exit_glass_vestibule",
        source: "walkthrough_navigation",
      },
    ],
  },
};

export type EvacExit = ExitDef & { blocked: boolean };
export type RouteStatus = "open" | "partial" | "blocked";
export type EvacRoute = {
  id: string;
  label: string;
  points: { x: number; y: number; z: number }[];
  status: RouteStatus;
  targetExitId: string;
  blockedFromIndex: number | null;
};
export type EvacPlan = {
  buildingId: string;
  calibrationSource: string;
  routes: EvacRoute[];
  exits: EvacExit[];
  assemblyExitId: string;
};

export function hasEvacPlan(buildingId: string): boolean {
  return buildingId in EVAC && buildingId in VIEWPOINTS;
}

function isBlocked(blockedAt: number | null, surgeFt: number) {
  return blockedAt !== null && surgeFt >= blockedAt;
}

export function openExitCount(plan: EvacPlan) {
  return plan.exits.filter((e) => !e.blocked).length;
}

/** Evaluate exits and routes for a given surge depth, in mesh-local coordinates. */
export function computeEvacPlan(buildingId: string, surgeFt: number, size: Size3): EvacPlan | null {
  const config = EVAC[buildingId];
  const viewpoints = VIEWPOINTS[buildingId];
  if (!config || !viewpoints) return null;

  const exits: EvacExit[] = config.exits.map((e) => ({
    ...e,
    blocked: isBlocked(e.blockedAtSurgeFt, surgeFt),
  }));
  const byId = new Map(exits.map((e) => [e.id, e]));

  const routes: EvacRoute[] = config.routes.map((route) => {
    const target = byId.get(route.targetExitId);
    const points = route.waypointViewpoints
      .map((id) => viewpoints[id] ?? null)
      .filter((p): p is NormPoint => p !== null)
      .map((p) => toLocal(p, size));

    // First waypoint whose exit is flooded at this surge depth.
    let blockedAt = -1;
    for (let i = 0; i < route.waypointViewpoints.length; i += 1) {
      const exit = exits.find((e) => e.viewpointId === route.waypointViewpoints[i]);
      if (exit && isBlocked(exit.blockedAtSurgeFt, surgeFt)) {
        blockedAt = i;
        break;
      }
    }

    let status: RouteStatus = "open";
    if (blockedAt !== -1) status = blockedAt === 0 ? "blocked" : "partial";
    else if (target?.blocked) status = "blocked";

    return {
      id: route.id,
      label: route.label,
      points,
      status,
      targetExitId: route.targetExitId,
      blockedFromIndex: blockedAt === -1 ? null : blockedAt,
    };
  });

  return {
    buildingId,
    calibrationSource: config.calibrationSource,
    routes,
    exits,
    assemblyExitId: config.assemblyExitId,
  };
}

/** Normalized water-plane height per surge stop (null = dry). */
const FLOOD_LEVELS: Record<string, Record<number, number | null>> = {
  [THE_DOCK]: { 0: null, 1: 0.08, 3: 0.13, 6: 0.24, 10: 0.4 },
  [BUILDING_A]: { 0: null, 1: 0.1, 3: 0.14, 6: 0.22, 10: 0.32 },
  [BUILDING_B]: { 0: null, 1: 0.09, 3: 0.13, 6: 0.2, 10: 0.3 },
};

export function floodLevel(buildingId: string, surgeFt: number): number | null {
  return FLOOD_LEVELS[buildingId]?.[surgeFt] ?? null;
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

/** Preferred scan asset per building; falls back to the building's scan_url. */
export const SCAN_URLS: Record<string, string | undefined> = {
  [BUILDING_A]: "/scans/building_a/scan.usdz",
  [BUILDING_B]: "/scans/building_b/scan.usdz",
  [THE_DOCK]: SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/scans/the_dock/scan.usdz`
    : undefined,
};
