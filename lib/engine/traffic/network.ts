// Independent vehicle network: never changes flood streets or drain assignments.
export type Point = [number, number];
export interface OsmElement {
  type: string; id: number; nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
}
export interface Link {
  id: string; way: number; from: string; to: string; name: string;
  coordinates: Point[]; length: number; seconds: number; capacity: number;
  speed: number; lanes: number; assumed: string[];
}
export interface Network {
  version: 1; fingerprint: string; links: Link[];
  forbidden: string[]; warnings: string[]; components: number;
}
export function distance(a: Point, b: Point) {
  return Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 111320);
}
export function buildNetwork(elements: OsmElement[]): Network {
  const links: Link[] = [];
  const warnings = new Set<string>();
  for (const e of elements) {
    const t = e.tags ?? {};
    if (e.type !== 'way' || !t.highway || !e.nodes || !e.geometry || e.nodes.length !== e.geometry.length) continue;
    const access = t.motorcar ?? t.motor_vehicle ?? t.vehicle ?? t.access;
    if (access && ['no', 'private', 'destination', 'delivery', 'customers'].includes(access)) continue;
    if (Object.keys(t).some(k => k.includes('conditional')) || ['reversible', 'alternating'].includes(t.oneway)) {
      warnings.add('Roads with conditional/reversible access excluded.'); continue;
    }
    const one = t.oneway === '-1' ? -1 : t.oneway === 'yes' || t.oneway === '1' || (t.oneway !== 'no' && ['roundabout'].includes(t.junction)) || (t.oneway !== 'no' && t.highway === 'motorway') ? 1 : 0;
    const rawSpeed = t.maxspeed && /^\d+(?:\.\d+)?(?: mph)?$/.test(t.maxspeed) ? parseFloat(t.maxspeed) * (t.maxspeed.includes('mph') ? 1.609344 : 1) : NaN;
    const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.min(130, rawSpeed) : ['primary', 'secondary', 'trunk', 'motorway'].includes(t.highway) ? 50 : 30;
    const total = Number(t.lanes);
    for (let i = 0; i < e.nodes.length - 1; i++) {
      const a: Point = [e.geometry[i].lon, e.geometry[i].lat];
      const b: Point = [e.geometry[i + 1].lon, e.geometry[i + 1].lat];
      const length = distance(a, b);
      if (length < .1) continue;
      for (const dir of one ? [one] : [1, -1]) {
        const specified = Number(t[dir === 1 ? 'lanes:forward' : 'lanes:backward']);
        const lanes = specified > 0 ? specified : total > 0 ? Math.max(1, Math.floor(total / (one ? 1 : 2))) : 1;
        const assumed = ['capacity'];
        if (!Number.isFinite(rawSpeed)) assumed.push('speed');
        if (!(specified > 0)) assumed.push('directional lanes');
        links.push({ id: `${e.id}:${i}:${dir}`, way: e.id, from: String(e.nodes[dir === 1 ? i : i + 1]), to: String(e.nodes[dir === 1 ? i + 1 : i]), name: t.name || `Road ${e.id}`, coordinates: dir === 1 ? [a,b] : [b,a], length, seconds: Math.max(1,length / (speed / 3.6)), capacity: lanes * (t.highway === 'service' ? 450 : 900), speed, lanes, assumed });
      }
    }
  }
  // Restrictions are enforced in routing by previous-link state.
  const forbidden = new Set<string>();
  for (const r of elements.filter(e => e.type === 'relation' && e.tags?.type === 'restriction')) {
    const from = r.members?.find(m => m.role === 'from');
    const to = r.members?.find(m => m.role === 'to');
    const via = r.members?.find(m => m.role === 'via');
    const rule = r.tags?.restriction ?? '';
    const supported = via?.type === 'node' && !r.tags?.['restriction:conditional'] && (rule.startsWith('no_') || rule.startsWith('only_'));
    if (!supported) warnings.add('Unsupported turn restrictions: affected departures conservatively excluded.');
    for (const a of links.filter(l => l.way === from?.ref && (!supported || l.to === String(via?.ref)))) {
      for (const b of links.filter(l => l.from === a.to)) {
        if (!supported || (rule.startsWith('only_') ? b.way !== to?.ref : b.way === to?.ref)) forbidden.add(`${a.id}>${b.id}`);
      }
    }
  }
  const adjacent = new Map<string, Set<string>>();
  for (const l of links) { if (!adjacent.has(l.from)) adjacent.set(l.from,new Set()); if (!adjacent.has(l.to)) adjacent.set(l.to,new Set()); adjacent.get(l.from)!.add(l.to); adjacent.get(l.to)!.add(l.from); }
  const seen = new Set<string>(); let components = 0;
  for (const n of adjacent.keys()) if (!seen.has(n)) { components++; const stack=[n]; seen.add(n); while(stack.length) for (const v of adjacent.get(stack.pop()!) ?? []) if (!seen.has(v)) { seen.add(v); stack.push(v); } }
  let hash=2166136261;
  for (const c of JSON.stringify([links, [...forbidden]])) hash=Math.imul(hash ^ c.charCodeAt(0),16777619) >>> 0;
  return { version:1, fingerprint:hash.toString(16), links, forbidden:[...forbidden], warnings:[...warnings], components };
}
export function route(network: Network, origin: string, destination: string, delays: Record<string,number> = {}): string[] | null {
  if(origin === destination) return [];
  const outgoing = new Map<string,Link[]>();
  for(const l of network.links) { const list=outgoing.get(l.from) ?? []; list.push(l); outgoing.set(l.from,list); }
  const banned=new Set(network.forbidden), costs=new Map<string,number>(), previous=new Map<string,string>();
  const pending=new Set<string>(), byId=new Map(network.links.map(l=>[l.id,l]));
  for(const l of outgoing.get(origin) ?? []) { costs.set(l.id,l.seconds+(delays[l.id]??0)); pending.add(l.id); }
  while(pending.size) {
    let best=''; let cost=Infinity;
    for(const id of pending) if(costs.get(id)! < cost) { best=id; cost=costs.get(id)!; }
    pending.delete(best); const link=byId.get(best)!;
    if(link.to===destination) { const path=[best]; while(previous.has(path[0])) path.unshift(previous.get(path[0])!); return path; }
    for(const next of outgoing.get(link.to) ?? []) {
      if(banned.has(`${best}>${next.id}`) || (next.to===link.from && (outgoing.get(link.to)?.length ?? 0)>1)) continue;
      const candidate=cost+next.seconds+(delays[next.id]??0);
      if(candidate < (costs.get(next.id) ?? Infinity)) { costs.set(next.id,candidate); previous.set(next.id,best); pending.add(next.id); }
    }
  }
  return null;
}
