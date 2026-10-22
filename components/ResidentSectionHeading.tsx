type Props = {
  kind: "location" | "route" | "help";
  title: string;
  subtitle?: string;
  level?: "h1" | "h2";
};

export default function ResidentSectionHeading({ kind, title, subtitle, level: Heading = "h2" }: Props) {
  const colors = { location: "bg-blue-50 text-blue-700", route: "bg-violet-50 text-violet-700", help: "bg-rose-50 text-rose-600" };
  return <div className="flex min-w-0 items-center gap-3">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[kind]}`}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {kind === "location" ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>
          : kind === "route" ? <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7" /></>
          : <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6" /></>}
      </svg>
    </span>
    <div className="min-w-0"><Heading className="text-sm font-semibold tracking-tight text-stone-900">{title}</Heading>
      {subtitle && <p className="mt-1 text-xs leading-relaxed text-stone-500">{subtitle}</p>}
    </div>
  </div>;
}
