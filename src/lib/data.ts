import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Building, PreplanSummary } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Seed building used when Supabase isn't configured, so the demo still runs.
export const DEMO_BUILDING: Building = {
  id: "e5a3fddc-e22c-431c-a5d3-ee29ef8604d1",
  address: "400 NW 26th St, Miami, FL 33127",
  lat: 25.8012674435035,
  lng: -80.202171638964,
  scan_url:
    "https://vsykrzfyvhnrwjyleywl.supabase.co/storage/v1/object/public/scans/the_dock/scan.glb",
  is_demo: true,
  created_at: "2026-06-05T01:31:20.939075+00:00",
};

function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

export async function getBuildings(): Promise<Building[]> {
  const sb = client();
  if (!sb) return [DEMO_BUILDING];
  const { data, error } = await sb
    .from("buildings")
    .select("id, address, lat, lng, scan_url, is_demo, created_at")
    .order("is_demo", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[buildings]", error.message);
    return [DEMO_BUILDING];
  }
  return data ?? [];
}

export async function getBuilding(id: string): Promise<Building | null> {
  const sb = client();
  if (!sb) return id === DEMO_BUILDING.id ? DEMO_BUILDING : null;
  const { data, error } = await sb
    .from("buildings")
    .select("id, address, lat, lng, scan_url, is_demo, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[building]", error.message);
    return id === DEMO_BUILDING.id ? DEMO_BUILDING : null;
  }
  return data;
}

export async function getRecentPreplans(): Promise<{
  preplans: PreplanSummary[];
  count: number;
}> {
  const sb = client();
  if (!sb) return { preplans: [], count: 0 };
  const { data, count, error } = await sb
    .from("preplans")
    .select("id, created_at, scenario_params, building:buildings(address)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) {
    console.error("[preplans]", error.message);
    return { preplans: [], count: 0 };
  }
  return { preplans: (data ?? []) as unknown as PreplanSummary[], count: count ?? 0 };
}
