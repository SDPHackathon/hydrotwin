"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { HELP_TYPES, MAX_HELP_NAME_CHARS, MAX_NOTE_CHARS } from "@/lib/engine/help";
import type { GuardTask, HelpType } from "@/lib/engine/types";
import type { RoadPoint } from "@/lib/engine/route";
import { translateHelpType, translateTaskOutcome } from "@/lib/translations";
import ResidentSectionHeading from "@/components/ResidentSectionHeading";

const TOKEN_KEY = "hydrotwin_location_help_v1";
export default function LocationHelpCard({ area, origin, open, onOpen, language }: {
  area: string; origin: RoadPoint | null; open: boolean; onOpen: (value: boolean) => void; language: "en" | "bm";
}) {
  const [task, setTask] = useState<GuardTask | null>(null);
  const [name, setName] = useState("");
  const [helpType, setHelpType] = useState<HelpType>("evacuate");
  const [people, setPeople] = useState(1), [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const token = useRef<string | null>(null), mutation = useRef(0);
  const previous = useRef<string | null>(null);
  const bm = language === "bm";
  const getToken = useCallback(() => {
    if (!token.current) { try { token.current = sessionStorage.getItem(TOKEN_KEY); } catch { /* memory fallback */ } }
    return token.current;
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      const currentToken = getToken(), seq = mutation.current;
      try {
        if (currentToken) {
          const res = await fetch("/api/resident/location-help", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read", token: currentToken }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
          if (!res.ok) throw new Error("Help desk unavailable");
          const data = await res.json();
          if (active && seq === mutation.current) {
            const state = data.task ? `${data.task.id}:${data.task.state}` : null;
            if (previous.current && previous.current !== state) { try { navigator.vibrate?.([180, 80, 180]); } catch { /* optional */ } }
            previous.current = state;
            setTask(data.task);
            if (!open && data.task) {
              setName(data.task.resident_name === "Demo location request" ? "" : data.task.resident_name ?? "");
              setHelpType(data.task.help_type ?? "evacuate"); setPeople(data.task.people ?? 1); setNote(data.task.note ?? "");
            }
          }
        }
      } catch { /* Keep the last task without claiming an action succeeded. */ }
      finally { if (active) timer = setTimeout(poll, 1500); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [getToken, open]);
  const live = task && !["done", "cancelled"].includes(task.state);
  const send = async (action: "request" | "safe" | "cancel") => {
    if (busy || (action === "request" && !live && !origin)) return;
    if (action === "request" && !name.trim()) { setError(bm ? "Masukkan nama anda." : "Enter your name."); return; }
    setBusy(true); setError(""); mutation.current++;
    try {
      const requestOrigin = live && task.position ? { street_id: task.street_id, position: task.position } : origin;
      const res = await fetch("/api/resident/location-help", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token: getToken() ?? undefined, area_slug: live ? task.area_slug : area, origin: requestOrigin, name, help_type: helpType, people, note }),
        signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update help request");
      if (data.token) { token.current = data.token; try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch { /* memory fallback */ } }
      mutation.current++; setTask(data.task); onOpen(false); setConfirmCancel(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reach the demo guard desk"); }
    finally { setBusy(false); }
  };
  return <section id="location-help" className="scroll-mt-24 space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
    <ResidentSectionHeading kind="help" title={bm ? "Bantuan pemindahan demo" : "Demo evacuation assistance"}
      subtitle={bm ? "Nama dan lokasi pilihan anda dikongsi dengan meja pengawal demo." : "Your name and selected location are shared with the demo guard desk."} />
    {task && <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs" role="status" aria-live="polite">
      <p className="font-bold">{task.resident_name}</p>
      <p className="font-semibold">{task.area_name} · {task.street_name}</p>
      <p>{task.state === "open" ? (bm ? "Permintaan dihantar · menunggu pengawal" : "Request sent · waiting for a guard") : task.state === "on_the_way" ? `Guard ${task.responder_name ?? ""} · ${bm ? "dalam perjalanan" : "on the way"}` : task.state === "cancelled" ? (bm ? "Permintaan dibatalkan" : "Request cancelled") : (bm ? "Selesai" : "Resolved")}</p>
      <p>{translateHelpType(task.help_type ?? "other", language)} · {task.people ?? 1} {bm ? "orang" : "people"}{task.note ? ` · ${task.note}` : ""}</p>
      {task.outcome && <p>{translateTaskOutcome(task.outcome, language)}{task.outcome_note ? ` · ${task.outcome_note}` : ""}</p>}
      {task.check_in_state === "safe" && <p>{bm ? "Anda melaporkan diri selamat." : "You reported that you are safe."}</p>}
      {live && <p className="text-stone-500">{bm ? "Menukar lokasi laluan tidak memindahkan permintaan ini." : "Changing the route location does not move this existing request."}</p>}
    </div>}
    {open ? <div className="space-y-3 text-xs">
      <label className="block font-medium text-stone-700">{bm ? "Nama" : "Name"}<input type="text" required autoComplete="off" maxLength={MAX_HELP_NAME_CHARS} value={name} onChange={(e) => setName(e.target.value)} placeholder={bm ? "Gunakan nama rekaan untuk demo" : "Use a fictional name for the demo"} className="mt-1.5 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-base font-normal text-stone-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
      <label className="block font-medium text-stone-700">{bm ? "Jenis bantuan" : "Help needed"}<select className="mt-1.5 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-base font-normal text-stone-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={helpType} onChange={(e) => setHelpType(e.target.value as HelpType)}>{HELP_TYPES.map((t) => <option key={t.id} value={t.id}>{translateHelpType(t.id, language)}</option>)}</select></label>
      <label className="block font-medium text-stone-700">{bm ? "Bilangan orang" : "People needing help"}<input type="number" min={1} max={10} value={people} onChange={(e) => setPeople(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="mt-1.5 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-base font-normal text-stone-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
      <label className="block font-medium text-stone-700">{bm ? "Nota pilihan (maklumat rekaan sahaja)" : "Optional note (fictional demo information only)"}<input value={note} maxLength={MAX_NOTE_CHARS} onChange={(e) => setNote(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-base font-normal text-stone-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
      <div className="flex gap-2"><button disabled={busy || !name.trim() || (!origin && !live)} onClick={() => void send("request")} className="min-h-11 flex-1 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50">{busy ? "…" : bm ? "Hantar permintaan" : "Send help request"}</button><button disabled={busy} onClick={() => onOpen(false)} className="min-h-11 rounded-lg border border-stone-300 bg-stone-100 px-4 font-semibold text-stone-700 transition hover:bg-stone-200">{bm ? "Tutup" : "Close"}</button></div>
    </div> : <button disabled={busy || (!origin && !live)} onClick={() => { setHelpType(live ? task.help_type ?? "evacuate" : "evacuate"); setPeople(live ? task.people ?? 1 : 1); setNote(live ? task.note ?? "" : ""); onOpen(true); }} className="min-h-11 w-full rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50">{live ? (bm ? "Kemas kini permintaan" : "Update request") : (bm ? "Saya perlukan bantuan" : "I need help")}</button>}
    {!origin && !live && <p className="text-xs text-stone-500">{bm ? "Pilih lokasi dahulu supaya pengawal tahu tempat bantuan diperlukan." : "Choose a location first so the guard knows where help is needed."}</p>}
    {live && <div className="flex gap-2 text-xs"><button disabled={busy} onClick={() => void send("safe")} className="min-h-11 flex-1 rounded-lg border border-emerald-300 text-emerald-800">{bm ? "Saya selamat sekarang" : "I'm safe now"}</button><button disabled={busy} onClick={() => setConfirmCancel(true)} className="min-h-11 flex-1 rounded-lg border border-stone-300">{bm ? "Batalkan permintaan" : "Cancel request"}</button></div>}
    {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
    {confirmCancel && <div role="dialog" aria-modal="true" aria-labelledby="cancel-help-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5"><h3 id="cancel-help-title" className="font-bold">{bm ? "Batalkan permintaan bantuan?" : "Cancel your help request?"}</h3><p className="text-xs">{bm ? "Meja pengawal akan dimaklumkan." : "The guard desk will be told you cancelled."}</p><div className="flex gap-2"><button onClick={() => setConfirmCancel(false)} className="min-h-11 flex-1 rounded-lg border">{bm ? "Kekalkan" : "Keep request"}</button><button disabled={busy} onClick={() => void send("cancel")} className="min-h-11 flex-1 rounded-lg bg-rose-700 text-white">{bm ? "Ya, batalkan" : "Yes, cancel"}</button></div></div></div>}
  </section>;
}
