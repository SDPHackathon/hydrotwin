import Link from "next/link";

type Props = {
  title: string;
  badge: string;
  badgeClassName: string;
  subtitle: string;
  links: { href: string; label: string }[];
};

// Sticky header for the phone pages, sized for 360–430 px screens: title + badge on one row, subtitle +
// nav on the next, nothing allowed to wrap. The safe-area padding only matters if a page ever draws
// under the status bar (black-translucent); with the default style it is 0. The nav is hidden in the
// installed app: its scope is one page, and a soft navigation to the dashboard has no way back.
export default function PhoneHeader({ title, badge, badgeClassName, subtitle, links }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 shadow-xs pt-[env(safe-area-inset-top)]">
      <div className="max-w-md mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-stone-900 tracking-tight truncate">{title}</span>
          <span className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full font-medium ${badgeClassName}`}>{badge}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500 truncate">{subtitle}</p>
          <nav className="flex items-center gap-1.5 shrink-0 text-[11px] [@media(display-mode:standalone)]:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium whitespace-nowrap">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
