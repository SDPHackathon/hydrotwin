import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { sharedTownships } from "@/lib/shared-townships";

export const metadata: Metadata = {
  title: "HydroTwin Phone Links",
  description: "Choose the resident, storm control or guard page for HydroTwin.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f5f5f4" };

const pages = [
  { path: "/resident", title: "Resident", description: "Check your street, view demo routes and request help.",
    icon: "M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8", color: "bg-violet-100 text-violet-800" },
  { path: "/control", title: "Storm Control", description: "Start or pause the demo storm and adjust water levels.",
    icon: "M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 10h6", color: "bg-emerald-100 text-emerald-800" },
  { path: "/guard", title: "Guard", description: "Open the duty desk to review help requests and respond.",
    icon: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6", color: "bg-stone-200 text-stone-800" },
];

export default async function PhonePage({ searchParams }: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { area: requested } = await searchParams;
  const areaSlug = typeof requested === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(requested) ? requested : "bukit-raja";
  const area = (await sharedTownships()).find((item) => item.slug === areaSlug);
  return <main className="flex min-h-dvh items-center justify-center bg-stone-100 px-5 py-10 text-stone-900">
    <div className="w-full max-w-md space-y-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-emerald-800">HydroTwin</p>
        <h1 className="text-2xl font-bold tracking-tight">Choose your phone page</h1>
        <p className="text-sm text-stone-600">{area?.name ?? "Selected township"}</p>
      </header>
      {!area && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This township is not shared yet. Open its downloaded copy on the dashboard first.</p>}
      <nav aria-label="Phone pages" className="space-y-3">
        {pages.map((page) => <Link key={page.path} href={page.path === "/guard" ? "/guard" : { pathname: page.path, query: { area: areaSlug } }} prefetch={false}
          className="flex min-h-24 items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${page.color}`}>
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={page.icon} /></svg>
          </span>
          <span className="min-w-0 flex-1"><span className="block text-base font-bold">{page.title}</span><span className="mt-1 block text-xs leading-relaxed text-stone-600">{page.description}</span></span>
          <span aria-hidden="true" className="text-lg text-stone-400">→</span>
        </Link>)}
      </nav>
      <p className="text-xs leading-relaxed text-stone-500">Use your browser’s Back button to return here and choose another page.</p>
      <footer className="border-t border-stone-200 pt-4 text-[11px] leading-relaxed text-stone-500">Demo only · Simulated drain zones and per-street water depth, not hydraulics.</footer>
    </div>
  </main>;
}
