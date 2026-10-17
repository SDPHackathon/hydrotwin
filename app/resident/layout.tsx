import type { Metadata, Viewport } from "next";

// Makes /resident installable from the phone's browser (Add to Home Screen). Android needs HTTPS for
// standalone mode, so over the laptop's http:// link it installs as a shortcut; iPhone opens full-screen.
export const metadata: Metadata = {
  title: "HydroTwin Resident",
  description: "Your street's flood status, early warning and a call-for-help line to the township guards.",
  manifest: "/resident.webmanifest",
  appleWebApp: { capable: true, title: "Resident", statusBarStyle: "default" },
  icons: { apple: "/icons/resident-180.png" },
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
