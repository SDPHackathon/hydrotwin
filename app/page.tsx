import Dashboard from "@/components/Dashboard";
import { listAreas, loadArea } from "@/lib/area";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area: requestedSlug } = await searchParams;
  const areas = await listAreas();
  const selectedSlug = areas.some((a) => a.slug === requestedSlug) ? (requestedSlug as string) : "bukit-raja";
  const { area, drains, streets } = await loadArea(selectedSlug);

  return <Dashboard area={area} areas={areas} drains={drains} streets={streets} />;
}
