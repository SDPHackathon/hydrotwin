"use client";

import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  areaSlug: string;
}

export default function MobileLinksModal({ isOpen, onClose, areaSlug }: Props) {
  const [origin] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:3000";
  });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  if (!isOpen) return null;

  const links = [
    {
      title: "Phone Storm Controller",
      path: `/control?area=${encodeURIComponent(areaSlug)}`,
      badge: "LIVE-3",
      desc: "Drive the storm, test speeds, and inject manual flood levels per drain for judges.",
      icon: "🎛️",
    },
    {
      title: "Resident Portal",
      path: `/resident?area=${encodeURIComponent(areaSlug)}`,
      badge: "LIVE-5",
      desc: "Locate a starting road or search street hints, then view demo routing and request assistance.",
      icon: "📱",
    },
    {
      title: "Guard Emergency Response",
      path: "/guard",
      badge: "LIVE-6",
      desc: "Live security desk receiving vulnerable resident tasks and responding to SOS calls.",
      icon: "🛡️",
    },
  ];

  const handleCopy = (path: string) => {
    const fullUrl = `${origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-stone-900">Mobile Phone Companion Links</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Live Loop
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Open on any smartphone on the same Wi-Fi network or locally.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 flex items-center justify-between">
            <span className="font-medium">Current Host Address:</span>
            <span className="font-mono font-semibold text-stone-800">{origin}</span>
          </div>

          <div className="space-y-2.5">
            {links.map((link) => (
              <div
                key={link.path}
                className="p-3 rounded-xl border border-stone-200 hover:border-stone-300 bg-white transition space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{link.icon}</span>
                    <span className="text-sm font-semibold text-stone-900">{link.title}</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded">
                      {link.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(link.path)}
                      className="text-xs font-medium px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                    >
                      {copiedPath === link.path ? "Copied! ✓" : "Copy Link"}
                    </button>
                    <a
                      href={link.path}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-stone-900 text-white hover:bg-stone-800 transition"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
                <p className="text-xs text-stone-500">{link.desc}</p>
                <div className="text-[11px] font-mono text-stone-400 truncate">
                  {origin}{link.path}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-center text-xs text-stone-500">
            Tip: Connect your laptop and phone to the same Wi-Fi, then visit this URL on your phone browser.
          </div>
        </div>

        <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
