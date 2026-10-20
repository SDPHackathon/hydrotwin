import Link from "next/link";

type Props = {
  title: string;
  badge: string;
  badgeClassName: string;
  subtitle: string;
  links: { href: string; label: string }[];
  language?: "en" | "bm";
  onToggleLanguage?: () => void;
};

export default function PhoneHeader({
  title,
  badge,
  badgeClassName,
  subtitle,
  links,
  language = "en",
  onToggleLanguage,
}: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 shadow-xs pt-[env(safe-area-inset-top)]">
      <div className="max-w-md mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-stone-900 tracking-tight truncate">
            {title}
          </span>

          <span
            className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full font-medium ${badgeClassName}`}
          >
            {badge}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-stone-500 truncate">{subtitle}</p>

          <div className="flex items-center gap-1.5 shrink-0">
            <nav className="flex items-center gap-1.5 shrink-0 text-[11px] [@media(display-mode:standalone)]:hidden">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium whitespace-nowrap"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            {onToggleLanguage && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[11px] font-semibold ${
                    language === "en" ? "text-blue-700" : "text-stone-400"
                  }`}
                >
                  EN
                </span>

                <button
                  type="button"
                  onClick={onToggleLanguage}
                  className={`relative flex items-center w-10 h-5 rounded-full p-0.5 transition-colors ${
                    language === "bm" ? "bg-blue-600" : "bg-stone-300"
                  }`}
                  aria-label="Change language"
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      language === "bm" ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <span
                  className={`text-[11px] font-semibold ${
                    language === "bm" ? "text-blue-700" : "text-stone-400"
                  }`}
                >
                  BM
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
