import { MapDashboard } from "@/components/dashboard/map-dashboard";
import { getBuildings, getRecentPreplans } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [buildings, { preplans, count }] = await Promise.all([
    getBuildings(),
    getRecentPreplans(),
  ]);

  return (
    <MapDashboard
      buildings={buildings}
      preplans={preplans}
      preplanCount={count}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
    />
  );
}
