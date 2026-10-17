import type { Metadata, Viewport } from "next";

// Makes /guard installable from the phone's browser (Add to Home Screen) — see app/resident/layout.tsx.
export const metadata: Metadata = {
  title: "HydroTwin Guard",
  description: "Duty desk for township guards: help calls, vulnerable residents on flooded streets, route to each one.",
  manifest: "/guard.webmanifest",
  appleWebApp: { capable: true, title: "Guard", statusBarStyle: "default" },
  icons: { apple: "/icons/guard-180.png" },
};

export const viewport: Viewport = { themeColor: "#1c1917", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
