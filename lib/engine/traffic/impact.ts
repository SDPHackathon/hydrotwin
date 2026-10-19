import { boundaryError } from '../development.ts';
import { distance, route, type Network, type Point, type Link } from './network.ts';
import { anchors } from './scenario.ts';

export interface TownshipProposal {
  name: string; boundary: Point[]; kind: 'housing'|'commercial'; size: number;
  tripRate: number; outbound: number; access: string;
}
export interface TrafficObservation {
  id: string; coordinates: Point[]; currentSpeed: number; freeFlowSpeed: number;
  currentTravelTime: number; freeFlowTravelTime: number; confidence: number;
  closed: boolean; fetchedAt: string;
}
export interface TrafficBaseline { provider: 'TomTom'; retrievedAt: string; observations: TrafficObservation[]; requested: number; failed: number }
export interface ImpactRoad {
  id: string; name: string; extraVehicles: number; observed: boolean;
  observationId: string|null;
  currentSeconds: number|null; proposedSeconds: number|null;
  currentSpeed: number|null; proposedSpeed: number|null; confidence: number|null;
  closed: boolean;
}
export interface ImpactResult {
  roads: ImpactRoad[]; tripsPerHour: number; assignedPerHour: number; unassignedPerHour: number;
  destinations: {id:string;name:string;weight:number}[];
  affectedRoads: number; coveredRoads: number; newlyCongested: number;
  alreadyCongested: number;
  addedVehicleMinutes: number; routeCoverage: number;
}
export const newTownship = (): TownshipProposal => ({name:'New township',boundary:[],kind:'housing',size:1000,tripRate:.5,outbound:80,access:''});
export function proposalError(p: TownshipProposal | TownshipProposal[], n: Network, bbox: number[]): string|null {
  const list = Array.isArray(p) ? p : [p];
  if (!list.length) return 'Add at least one township site.';
  for (const item of list) {
    if(!item || !Array.isArray(item.boundary) || item.boundary.some(v=>!Array.isArray(v)||v.length!==2||v.some(x=>!Number.isFinite(x)))) return 'Invalid site outline.';
    const geometryError=boundaryError(item.boundary); if(geometryError) return geometryError;
    if(item.boundary.some(([x,y])=>x<bbox[1]||x>bbox[3]||y<bbox[0]||y>bbox[2])) return 'Draw the township inside the selected map area.';
    if(!['housing','commercial'].includes(item.kind)||!Number.isFinite(item.size)||item.size<=0||item.size>1000000||!Number.isFinite(item.tripRate)||item.tripRate<0||item.tripRate>100||!Number.isFinite(item.outbound)||item.outbound<0||item.outbound>100) return 'Enter a valid township size and trip-generation assumptions.';
    if(!n.links.some(l=>l.from===item.access)) return `Choose an existing road connection for ${item.name || 'the township'}.`;
    if(item.size*item.tripRate/(item.kind==='commercial'?100:1)>10000) return 'This screening model supports up to 10,000 additional vehicle trips/hour per site.';
  }
  return null;
}
function centre(boundary:Point[]):Point {return [boundary.reduce((v,p)=>v+p[0],0)/boundary.length,boundary.reduce((v,p)=>v+p[1],0)/boundary.length];}
export function automaticAccess(n:Network,boundary:Point[]):string {
  if(boundaryError(boundary)) return '';
  const c=centre(boundary);
  return anchors(n).map(v=>({...v,d:distance(c,v.point)})).filter(v=>v.d<=600&&n.links.some(l=>l.from===v.id)&&n.links.some(l=>l.to===v.id)).sort((a,b)=>a.d-b.d)[0]?.id??'';
}
// Candidate connections across the township network: 70% external perimeter gateways + 30% internal hubs, weighted by road capacity.
export function surroundingConnections(n:Network,p:TownshipProposal) {
  const origin=anchors(n).find(v=>v.id===p.access); if(!origin) return [];
  const sectors=new Map<number,ReturnType<typeof anchors>>();
  for(const node of anchors(n)) {
    const d=distance(origin.point,node.point);if(d<200||d>6000)continue;
    const angle=Math.atan2(node.point[1]-origin.point[1],node.point[0]-origin.point[0]);
    const sector=Math.floor(((angle+Math.PI)/(Math.PI/4)))%8;
    const values=sectors.get(sector)??[];values.push(node);sectors.set(sector,values);
  }
  interface Candidate { id: string; name: string; dist: number; capacity: number }
  const reachable: Candidate[] = [];
  for(const values of sectors.values()) {
    const sorted=values.sort((a,b)=>distance(origin.point,b.point)-distance(origin.point,a.point));
    let added=0;
    for(const node of sorted) {
      if(route(n,p.access,node.id)?.length && route(n,node.id,p.access)?.length) {
        const d=distance(origin.point,node.point);
        const incidentCaps=n.links.filter(l=>l.from===node.id||l.to===node.id).map(l=>l.capacity);
        const cap=incidentCaps.length?Math.max(...incidentCaps):900;
        reachable.push({id:node.id,name:node.name,dist:d,capacity:cap});
        added++;
        if(added>=2) break;
      }
    }
  }
  // Fallback for minimal networks (e.g. test linear networks)
  if(!reachable.length) {
    for(const node of anchors(n)) {
      if(node.id!==p.access && route(n,p.access,node.id)?.length && route(n,node.id,p.access)?.length) {
        const d=distance(origin.point,node.point);
        const incidentCaps=n.links.filter(l=>l.from===node.id||l.to===node.id).map(l=>l.capacity);
        const cap=incidentCaps.length?Math.max(...incidentCaps):900;
        reachable.push({id:node.id,name:node.name,dist:d,capacity:cap});
      }
    }
  }
  if(!reachable.length) return [];

  // Partition into external gateways (dist >= 1200m or furthest half) and internal hubs
  let external = reachable.filter(c => c.dist >= 1200);
  let internal = reachable.filter(c => c.dist < 1200);

  if(!external.length && reachable.length > 1) {
    const medianDist = [...reachable].sort((a,b)=>a.dist-b.dist)[Math.floor(reachable.length/2)].dist;
    external = reachable.filter(c => c.dist >= medianDist);
    internal = reachable.filter(c => c.dist < medianDist);
  }

  const extCapTotal = external.reduce((sum, c) => sum + c.capacity, 0) || 1;
  const intCapTotal = internal.reduce((sum, c) => sum + c.capacity, 0) || 1;

  const extShare = internal.length ? 0.70 : 1.0;
  const intShare = external.length ? 0.30 : 1.0;

  const result: { id: string; name: string; weight: number }[] = [];
  for (const c of external) {
    result.push({ id: c.id, name: c.name, weight: extShare * (c.capacity / extCapTotal) });
  }
  for (const c of internal) {
    result.push({ id: c.id, name: c.name, weight: intShare * (c.capacity / intCapTotal) });
  }

  const weightSum = result.reduce((s, c) => s + c.weight, 0) || 1;
  return result.map(c => ({ id: c.id, name: c.name, weight: c.weight / weightSum }));
}
export function additionalTrips(p:TownshipProposal) {return p.size*p.tripRate/(p.kind==='commercial'?100:1);}

function separation(point:Point,a:Point,b:Point) {
  const scale=Math.cos(point[1]*Math.PI/180), dx=(b[0]-a[0])*scale,dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,(((point[0]-a[0])*scale*dx)+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return distance(point,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
}
const observationBounds=new WeakMap<TrafficObservation,number[]>();
export function matchObservation(link:Link, observations:TrafficObservation[], now:number):TrafficObservation|null {
  const a=link.coordinates[0],b=link.coordinates[link.coordinates.length-1];
  const mid:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  let best:TrafficObservation|null=null, score=Infinity;
  for(const observation of observations) {
    const age=now-Date.parse(observation.fetchedAt);
    if(!Number.isFinite(age)||age>300000||age < -30000||observation.confidence<.5||(!observation.closed&&(observation.freeFlowSpeed<=0||observation.currentSpeed<=0)))continue;
    let bounds=observationBounds.get(observation);
    if(!bounds){bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const [x,y] of observation.coordinates){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}observationBounds.set(observation,bounds);}
    const marginX=25/(111320*Math.max(.05,Math.cos(mid[1]*Math.PI/180))),marginY=25/111320;
    if(mid[0]<bounds[0]-marginX||mid[0]>bounds[2]+marginX||mid[1]<bounds[1]-marginY||mid[1]>bounds[3]+marginY)continue;
    let closest=Infinity;
    for(let i=0;i<observation.coordinates.length-1;i++) {
      const c=observation.coordinates[i],d=observation.coordinates[i+1];
      const cosine=((b[0]-a[0])*(d[0]-c[0])+(b[1]-a[1])*(d[1]-c[1]))/(Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(d[0]-c[0],d[1]-c[1])||1);
      if(cosine<.85)continue;
      closest=Math.min(closest,separation(mid,c,d));
    }
    if(closest>=20||closest>=score)continue;
    // Check endpoints once per candidate observation, rather than once per polyline edge.
    const endpointGap=Math.max(...[a,b].map(pt=>Math.min(...observation.coordinates.slice(0,-1).map((x,j)=>separation(pt,x,observation.coordinates[j+1])))));
    if(endpointGap<25){best=observation;score=closest;}
  }
  return best;
}
// BPR-style sensitivity curve. Existing flow/capacity is inferred from speed, never a measured count.
export function projectedSeconds(length:number,currentSpeed:number,freeSpeed:number,extra:number,capacity:number) {
  const t0=length/(freeSpeed/3.6), current=length/(currentSpeed/3.6);
  const inferredRatio=Math.pow(Math.max(0,current/t0-1)/.15,.25);
  return current+t0*.15*(Math.pow(inferredRatio+extra/capacity,4)-Math.pow(inferredRatio,4));
}
export function impactColour(speed:number|null,freeSpeed:number|null,closed=false):string {
  if(closed)return '#7f1d1d';if(speed===null||freeSpeed===null)return '#a8a29e';
  const ratio=speed/freeSpeed;return ratio<.4?'#dc2626':ratio<.7?'#d97706':'#059669';
}
export function assessTownship(n:Network,p:TownshipProposal|TownshipProposal[],baseline:TrafficBaseline,now:number):ImpactResult {
  if(!baseline.observations.length)throw Error('Current traffic observations are required.');
  if(!Number.isFinite(Date.parse(baseline.retrievedAt))||now-Date.parse(baseline.retrievedAt)>300000)throw Error('Traffic snapshot expired. Refresh current traffic.');
  const proposals=Array.isArray(p)?p:[p];
  if(!proposals.length)throw Error('At least one proposal site is required.');
  const observations=new Map(n.links.map(l=>[l.id,matchObservation(l,baseline.observations,now)]));
  const closed=new Set(n.links.filter(l=>observations.get(l.id)?.closed).map(l=>l.id));
  const openNetwork={...n,links:n.links.filter(l=>!closed.has(l.id))};
  
  let totalTripsPerHour=0;
  let assignedPerHour=0;
  const extra=new Map<string,number>();
  const allDestinationsMap=new Map<string,{id:string;name:string;weight:number}>();

  for(const prop of proposals) {
    const propTrips=additionalTrips(prop);
    totalTripsPerHour+=propTrips;
    for(const d of surroundingConnections(n,prop)) allDestinationsMap.set(d.id,d);
  }

  // Incremental 10-batch assignment across all sites simultaneously so later batches adapt to accumulated delay
  for(let batch=0;batch<10;batch++) {
    for(const prop of proposals) {
      const propTrips=additionalTrips(prop);
      const destinations=surroundingConnections(n,prop);
      for(const dest of destinations) {
        for(const outbound of [true,false]) {
          const share=(outbound?prop.outbound:100-prop.outbound)/100;
          const quantity=propTrips*dest.weight*share/10;
          if(!quantity)continue;
          const delays:Record<string,number>={};
          for(const link of openNetwork.links) {
            const o=observations.get(link.id);
            const currentExtra=extra.get(link.id)??0;
            const seconds=o?projectedSeconds(link.length,o.currentSpeed,o.freeFlowSpeed,currentExtra,link.capacity):link.seconds*(1+.15*Math.pow(currentExtra/link.capacity,4));
            delays[link.id]=seconds-link.seconds;
          }
          const path=route(openNetwork,outbound?prop.access:dest.id,outbound?dest.id:prop.access,delays);
          if(!path?.length)continue;
          assignedPerHour+=quantity;
          for(const id of path)extra.set(id,(extra.get(id)??0)+quantity);
        }
      }
    }
  }

  const roads=n.links.map(l=>{
    const o=observations.get(l.id), added=extra.get(l.id)??0;
    const currentSeconds=o&&!o.closed?l.length/(o.currentSpeed/3.6):null;
    const proposedSeconds=o&&!o.closed?projectedSeconds(l.length,o.currentSpeed,o.freeFlowSpeed,added,l.capacity):null;
    return {id:l.id,name:l.name,extraVehicles:added,observed:!!o,observationId:o?.id??null,currentSeconds,proposedSeconds,currentSpeed:o?.currentSpeed??null,proposedSpeed:proposedSeconds?l.length/proposedSeconds*3.6:null,confidence:o?.confidence??null,closed:o?.closed??false};
  });
  const affected=roads.filter(r=>r.extraVehicles>.01), covered=affected.filter(r=>r.observed);
  const totalDistance=affected.reduce((v,r)=>v+n.links.find(l=>l.id===r.id)!.length*r.extraVehicles,0);
  const coveredDistance=covered.reduce((v,r)=>v+n.links.find(l=>l.id===r.id)!.length*r.extraVehicles,0);
  const destinations=[...allDestinationsMap.values()];
  const newlyCongested=covered.filter(r=>{
    const obs=observations.get(r.id);
    return obs&&r.currentSpeed!>=.4*obs.freeFlowSpeed&&r.proposedSpeed!<.4*obs.freeFlowSpeed;
  }).length;
  const alreadyCongested=covered.filter(r=>{
    const obs=observations.get(r.id);
    return obs&&r.currentSpeed!<.4*obs.freeFlowSpeed;
  }).length;
  const addedVehicleMinutes=covered.reduce((v,r)=>v+(r.proposedSeconds!-r.currentSeconds!)*r.extraVehicles/60,0);

  return {roads,tripsPerHour:totalTripsPerHour,assignedPerHour,unassignedPerHour:Math.max(0,totalTripsPerHour-assignedPerHour),destinations,affectedRoads:affected.length,coveredRoads:covered.length,routeCoverage:totalDistance?coveredDistance/totalDistance:0,newlyCongested,alreadyCongested,addedVehicleMinutes};
}
export function sampleCorridors(n:Network,p:TownshipProposal|TownshipProposal[],limit=24) {
  const proposals=Array.isArray(p)?p:[p];
  const used=new Map<string,number>();
  for(const prop of proposals) {
    const destinations=surroundingConnections(n,prop);
    for(const d of destinations) {
      for(const path of [route(n,prop.access,d.id),route(n,d.id,prop.access)]) {
        for(const id of path??[]) used.set(id,(used.get(id)??0)+1);
      }
    }
  }
  // Spread samples along corridors, then across unique OSM ways before using spare slots.
  const candidates=n.links.filter(l=>used.has(l.id)).sort((a,b)=>(used.get(b.id)!*b.length)-(used.get(a.id)!*a.length));
  const selected:Link[]=[];const ways=new Set<number>();
  for(const l of candidates)if(!ways.has(l.way)&&selected.length<limit){selected.push(l);ways.add(l.way);}
  for(const l of candidates)if(selected.length<limit&&!selected.includes(l))selected.push(l);
  return selected.map(l=>({id:l.id,point:[(l.coordinates[0][0]+l.coordinates[1][0])/2,(l.coordinates[0][1]+l.coordinates[1][1])/2] as Point}));
}
// Distributed sampling of township arterials and distributors to acquire real initial baseline speeds
export function sampleTownshipArterials(n:Network, limit=24) {
  if(!n.links.length) return [];
  const candidates=[...n.links].sort((a,b)=>(b.capacity*b.length)-(a.capacity*a.length));
  const selected:Link[]=[];const ways=new Set<number>();
  for(const l of candidates) {
    if(!ways.has(l.way)&&selected.length<limit){selected.push(l);ways.add(l.way);}
  }
  for(const l of candidates) {
    if(selected.length<limit&&!selected.includes(l)) selected.push(l);
  }
  return selected.map(l=>{
    const midIdx=Math.floor(l.coordinates.length/2);
    const p1=l.coordinates[Math.max(0,midIdx-1)];
    const p2=l.coordinates[midIdx];
    return {id:l.id,point:[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2] as Point};
  });
}
export interface RoadDisplay {
  color: string;
  width: number;
  casingWidth: number;
  status: 'closed' | 'congested' | 'slower' | 'freeflow' | 'unknown';
  isObserved: boolean;
}
// Honest road display rules: unobserved roads remain strictly grey (#a8a29e), closed roads dark red (#7f1d1d)
export function evaluateRoadDisplay(
  link: Link,
  obs: TrafficObservation | null | undefined,
  road: ImpactRoad | null | undefined,
  view: 'current' | 'proposed',
  metricView: 'speed' | 'delta',
  isSelected: boolean
): RoadDisplay {
  if (isSelected) {
    return { color: '#4f46e5', width: 7, casingWidth: 12, status: obs?.closed ? 'closed' : obs ? 'freeflow' : 'unknown', isObserved: !!obs };
  }

  if (metricView === 'delta') {
    const extra = road?.extraVehicles ?? 0;
    if (extra > 0.05) {
      if (extra < 30) return { color: '#06b6d4', width: 5, casingWidth: 9, status: 'slower', isObserved: !!obs };
      if (extra < 90) return { color: '#3b82f6', width: 6, casingWidth: 10, status: 'slower', isObserved: !!obs };
      if (extra < 220) return { color: '#f59e0b', width: 7, casingWidth: 11, status: 'congested', isObserved: !!obs };
      return { color: '#dc2626', width: 8, casingWidth: 12, status: 'congested', isObserved: !!obs };
    }
    return { color: '#e7e5e4', width: 3, casingWidth: 6, status: 'unknown', isObserved: !!obs };
  }

  // Speed & Congestion view
  if (obs?.closed) {
    return { color: '#7f1d1d', width: 6, casingWidth: 10, status: 'closed', isObserved: true };
  }

  if (obs) {
    const speed = (view === 'proposed' && road?.proposedSpeed != null) ? road.proposedSpeed : obs.currentSpeed;
    const ratio = obs.freeFlowSpeed > 0 ? speed / obs.freeFlowSpeed : 1;
    const extra = road?.extraVehicles ?? 0;
    const isHeavy = view === 'proposed' && extra > 20;
    const width = isHeavy ? 6 : 4;
    const casingWidth = isHeavy ? 10 : 8;

    if (ratio < 0.4) {
      return { color: '#dc2626', width, casingWidth, status: 'congested', isObserved: true };
    }
    if (ratio < 0.7) {
      return { color: '#d97706', width, casingWidth, status: 'slower', isObserved: true };
    }
    return { color: '#059669', width, casingWidth, status: 'freeflow', isObserved: true };
  }

  // Unobserved roads: strictly grey, NEVER green
  return { color: '#a8a29e', width: 3, casingWidth: 6, status: 'unknown', isObserved: false };
}

