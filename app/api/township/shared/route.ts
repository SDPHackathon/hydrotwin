import { NextRequest, NextResponse } from "next/server";
import { boundedJson, readSharedTownship, registerSharedTownship, sharedTownships } from "@/lib/shared-townships";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const area = request.nextUrl.searchParams.get("area");
  if (!area) return NextResponse.json({ areas: await sharedTownships(), source: "laptop-demo" }, { headers });
  const bundle = await readSharedTownship(area);
  return bundle ? NextResponse.json(bundle, { headers }) : NextResponse.json({ error: "Township is not shared. Open its downloaded copy on the dashboard first." }, { status: 404, headers });
}
export async function POST(request: NextRequest) {
  try {
    const bundle = await registerSharedTownship(await boundedJson(request));
    return NextResponse.json({ area: bundle.area, source: "laptop-demo", shared: true }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid demo township" }, { status: 400, headers });
  }
}
