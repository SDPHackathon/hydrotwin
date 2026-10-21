import { NextResponse } from "next/server";
import { generateTownship } from "@/lib/generator/pipeline";
import { registerSharedTownship } from "@/lib/shared-townships";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, bbox } = body;
    let { slug } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ success: false, error: "Township name is required" }, { status: 400 });
    }

    if (!slug || typeof slug !== "string") {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    } else {
      slug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n: unknown) => typeof n !== "number" || isNaN(n))) {
      return NextResponse.json({ success: false, error: "Valid bbox [south, west, north, east] is required" }, { status: 400 });
    }

    const bundle = await generateTownship({
      slug,
      name,
      bbox: bbox as [number, number, number, number],
    });
    await registerSharedTownship(bundle);
    return NextResponse.json({ success: true, data: bundle });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate township";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
