import type { Hazard, Preplan } from "./types";

export type ActionPriority = "SEVERE" | "HIGH" | "MODERATE";

export type ImmediateAction = {
  id: string;
  label: string;
  sublabel: string;
  priority: ActionPriority;
};

const PRIORITY_ORDER: Record<ActionPriority, number> = { SEVERE: 0, HIGH: 1, MODERATE: 2 };

function featureAction(
  feature: string,
  key: string,
  priority: ActionPriority,
): ImmediateAction | null {
  const f = feature.toLowerCase();
  if (/glass|glaz|curtain wall|window/.test(f))
    return {
      id: `glass-${key}`,
      label: "BOARD UP GROUND-FLOOR GLAZING",
      sublabel: "Plywood + impact film · prioritize south & east facades",
      priority,
    };
  if (/hvac|rooftop|condenser|mechanical/.test(f))
    return {
      id: `hvac-${key}`,
      label: "SECURE OR REMOVE ROOFTOP HVAC",
      sublabel: "Anchor unanchored units · projectile risk above 110 mph",
      priority,
    };
  if (/elevator|elev/.test(f))
    return {
      id: `elev-${key}`,
      label: "LOCK ELEVATORS · STAIR-ONLY EGRESS",
      sublabel: "Park cars at level 2 · seal pit + shaft penetrations",
      priority,
    };
  if (/electric|switchgear|transformer|vault/.test(f))
    return {
      id: `elec-${key}`,
      label: "PLAN ELECTRICAL SHUTDOWN AT GRADE",
      sublabel: "Coordinate FPL · isolate ground-level vaults",
      priority,
    };
  if (/stair/.test(f))
    return {
      id: `stair-${key}`,
      label: "INSPECT STAIRWELL INTEGRITY",
      sublabel: "Verify shelter-in-place route + emergency lighting",
      priority,
    };
  if (/ground floor|ground-floor|occup|evac/.test(f))
    return {
      id: `evac-floor-${key}`,
      label: "EVACUATE GROUND FLOOR TO UPPER FLOORS",
      sublabel: "Move ambulatory occupants to floors 3+",
      priority,
    };
  return null;
}

function pushHazardActions(out: ImmediateAction[], key: string, hazard: Hazard) {
  if (hazard.risk_score !== "SEVERE" && hazard.risk_score !== "HIGH") return;
  const priority: ActionPriority = hazard.risk_score === "SEVERE" ? "SEVERE" : "HIGH";
  for (const feature of hazard.vulnerable_features.slice(0, 3)) {
    const action = featureAction(feature, key, priority);
    if (action) out.push(action);
  }
}

function shortName(name: string) {
  return name
    .toUpperCase()
    .replace(/MEMORIAL HOSPITAL/g, "MEMORIAL")
    .replace(/HOSPITAL/g, "")
    .replace(/HIGH SCHOOL SHELTER/g, "SR HIGH")
    .replace(/HIGH SCHOOL/g, "SR HIGH")
    .replace(/SHELTER/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FALLBACK_ACTIONS: ImmediateAction[] = [
  {
    id: "standby",
    label: "STANDBY · MONITOR CONDITIONS",
    sublabel: "Watch NHC advisories + Miami-Dade EOC updates",
    priority: "MODERATE",
  },
  {
    id: "comms",
    label: "MAINTAIN COMMS WITH MIAMI-DADE FIRE RESCUE",
    sublabel: "Tactical channel 7 · 5-minute check-ins",
    priority: "MODERATE",
  },
];

/** Derive a dispatchable action list (5–7 items, most severe first) from a pre-plan. */
export function deriveActions(preplan: Preplan): ImmediateAction[] {
  const actions: ImmediateAction[] = [];

  const surgeZone = preplan.context.surge_zone;
  if (surgeZone) {
    const m = surgeZone.match(/\b([A-E])\b/);
    const zone = m ? `ZONE ${m[1]}` : "EVAC ZONE";
    actions.push({
      id: `evac-${zone}`,
      label: `ISSUE MANDATORY EVAC ORDER · ${zone}`,
      sublabel: "Notify county OEM · broadcast WEA + reverse-911",
      priority: "SEVERE",
    });
    actions.push({
      id: "stage-rescue",
      label: "STAGE HIGH-CLEARANCE RESCUE VEHICLES",
      sublabel: "Pre-position swift-water + brush trucks upwind",
      priority: "HIGH",
    });
  }

  const floodZone = preplan.context.flood_zone;
  if (/AE|VE|AO/i.test(floodZone)) {
    actions.push({
      id: "sandbags",
      label: "PRE-POSITION SANDBAGS AT GROUND ENTRY",
      sublabel: `Flood zone ${floodZone.split(" ")[0]} · BFE breach likely under scenario`,
      priority: "MODERATE",
    });
  }

  pushHazardActions(actions, "wind", preplan.hazards.wind);
  pushHazardActions(actions, "surge", preplan.hazards.surge);
  pushHazardActions(actions, "flood", preplan.hazards.flood);

  const hospital = preplan.context.nearest_hospital;
  if (hospital?.name) {
    actions.push({
      id: `hosp-${hospital.name}`,
      label: `COORDINATE WITH ${shortName(hospital.name)} · ${hospital.distance_mi}MI`,
      sublabel: "Confirm trauma capacity + helo LZ availability",
      priority: "MODERATE",
    });
  }

  const shelter = preplan.context.nearest_shelter;
  if (shelter?.name) {
    actions.push({
      id: `shelter-${shelter.name}`,
      label: `OPEN SHELTER · ${shortName(shelter.name)} · ${shelter.distance_mi}MI`,
      sublabel: "Coordinate Red Cross staffing + transport",
      priority: "HIGH",
    });
  }

  const seen = new Set<string>();
  const unique = actions.filter((a) => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  });
  unique.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const result = unique.slice(0, 7);
  for (const fallback of FALLBACK_ACTIONS) {
    if (result.length >= 5) break;
    if (!seen.has(fallback.label)) {
      seen.add(fallback.label);
      result.push(fallback);
    }
  }
  return result;
}
