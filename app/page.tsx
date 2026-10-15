import Dashboard from "@/components/Dashboard";
import { loadArea } from "@/lib/area";

export default async function Home() {
  const { area, drains, streets } = await loadArea("bukit-raja");
  return <Dashboard area={area} drains={drains} streets={streets} />;
}
