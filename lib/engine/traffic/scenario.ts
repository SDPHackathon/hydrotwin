import { boundaryError } from '../development.ts';
import { distance, route, type Network, type Point } from './network.ts';
import type { Scenario } from './sim.ts';
export interface Draft { preset:'morning'|'evening'|'custom'; perHour:number; origin:string; destination:string; minutes:number; kind:'housing'|'commercial'; size:number; rate:number; outbound:number; reduction:number; capacityWay:string; multiplier:number; boundary:Point[]; access:string; name:string }
export const defaultDraft:Draft={preset:'morning',perHour:900,origin:'',destination:'',minutes:30,kind:'housing',size:300,rate:.5,outbound:80,reduction:30,capacityWay:'',multiplier:1.5,boundary:[],access:'',name:'Traffic proposal'};
export function anchors(network:Network) {
  const nodes=new Map<string,{id:string;point:Point;name:string}>();
  for(const l of network.links) {nodes.set(l.from,{id:l.from,point:l.coordinates[0],name:l.name});nodes.set(l.to,{id:l.to,point:l.coordinates[l.coordinates.length-1],name:l.name});}
  return [...nodes.values()];
}
export function suggestedPair(network:Network):[string,string] {
  const nodes=anchors(network).sort((a,b)=>a.point[0]-b.point[0]);
  // Sample both directions, selecting a long reachable corridor without inventing links.
  let best:[string,string]=['',''];let length=0;
  const step=Math.max(1,Math.floor(nodes.length/6));
  for(let i=0;i<nodes.length;i+=step) for(let j=nodes.length-1;j>=0;j-=step) {
    const d=distance(nodes[i].point,nodes[j].point);
    if(d>length && route(network,nodes[i].id,nodes[j].id) && route(network,nodes[j].id,nodes[i].id)) {best=[nodes[i].id,nodes[j].id];length=d;}
  }
  return best;
}
export function suggestAccess(network:Network,boundary:Point[],destination:string) {
  if(boundary.length<3) return '';
  const candidates=anchors(network).map(n=>({...n,d:Math.min(...boundary.map(p=>distance(p,n.point)))})).filter(n=>n.d<=500).sort((a,b)=>a.d-b.d);
  return candidates.find(n=>n.id!==destination && route(network,n.id,destination) && route(network,destination,n.id))?.id ?? '';
}
export function draftError(d:Draft,network:Network,bbox:number[]):string|null {
  if(!Number.isFinite(d.minutes)||d.minutes<1||d.minutes>60||!Number.isFinite(d.reduction)||d.reduction<0||d.reduction>100||!Number.isFinite(d.multiplier)||d.multiplier<1||d.multiplier>4) return 'Use 1–60 departure minutes, 0–100% trip reduction and a capacity multiplier from 1 to 4.';
  if(!Number.isFinite(d.perHour)||d.perHour<0||d.perHour>5000||!Number.isFinite(d.size)||d.size<0||d.size>1000000||!Number.isFinite(d.rate)||d.rate<0||d.rate>100||!Number.isFinite(d.outbound)||d.outbound<0||d.outbound>100) return 'Enter valid, non-negative demand and development values.';
  if(!['housing','commercial'].includes(d.kind)||!['morning','evening','custom'].includes(d.preset)||!Array.isArray(d.boundary)||d.boundary.length>50||d.boundary.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)))) return 'Invalid proposal geometry or type.';
  if(!d.origin||!d.destination||d.origin===d.destination) return 'Choose two different traffic anchors.';
  if(!route(network,d.origin,d.destination)) return 'No legal vehicle route between the selected anchors.';
  if(d.boundary.length) {
    const error=boundaryError(d.boundary);if(error) return error;
    if(d.boundary.some(([x,y])=>y<bbox[0]||x<bbox[1]||y>bbox[2]||x>bbox[3])) return 'Keep the site inside the township extent.';
    if(!d.access || !route(network,d.access,d.destination) || !route(network,d.destination,d.access)) return 'Choose a site access junction with legal routes in both directions.';
  }
  return null;
}
export function makeScenario(d:Draft):Scenario {
  const extra=d.boundary.length ? d.size*d.rate/(d.kind==='commercial'?100:1) : 0;
  return {seed:42,minutes:d.minutes,reduction:d.reduction,capacityLink:d.capacityWay,capacityMultiplier:d.multiplier,demand:[
    {origin:d.origin,destination:d.destination,perHour:d.perHour,group:'background'},
    {origin:d.destination,destination:d.origin,perHour:d.perHour*(d.preset==='evening'?1.5:.4),group:'background'},
    ...(extra?[{origin:d.access,destination:d.destination,perHour:extra*d.outbound/100,group:'development' as const},{origin:d.destination,destination:d.access,perHour:extra*(1-d.outbound/100),group:'development' as const}]:[]),
  ]};
}
