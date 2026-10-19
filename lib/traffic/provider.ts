import type { Point } from '../engine/traffic/network.ts';
import type { TrafficObservation } from '../engine/traffic/impact.ts';
export interface TrafficSample { id:string; point:Point }
export function validateSamples(value:unknown):value is {bbox:number[];samples:TrafficSample[]} {
  if(!value || typeof value!=='object')return false;
  const {bbox,samples}=value as {bbox:unknown;samples:unknown};
  if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(x=>typeof x!=='number'||!Number.isFinite(x)))return false;
  if(bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||bbox[2]-bbox[0]>.055||bbox[3]-bbox[1]>.055||Math.abs(bbox[0])>85||Math.abs(bbox[2])>85||Math.abs(bbox[1])>180||Math.abs(bbox[3])>180)return false;
  if(!Array.isArray(samples)||samples.length<1||samples.length>24)return false;
  return samples.every(s=>s&&typeof s.id==='string'&&s.id.length<=100&&Array.isArray(s.point)&&s.point.length===2&&s.point.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v))&&s.point[0]>=bbox[1]-.02&&s.point[0]<=bbox[3]+.02&&s.point[1]>=bbox[0]-.02&&s.point[1]<=bbox[2]+.02);
}
export function parseFlow(value:unknown,id:string,fetchedAt:string):TrafficObservation|null {
  if(!value || typeof value!=='object')return null;
  const f=(value as {flowSegmentData?:Record<string,unknown>}).flowSegmentData;
  if(!f)return null;
  for(const key of ['currentSpeed','freeFlowSpeed','currentTravelTime','freeFlowTravelTime','confidence'])if(typeof f[key]!=='number'||!Number.isFinite(f[key])||f[key]<0)return null;
  if((f.confidence as number)>1||typeof f.roadClosure!=='boolean'||(!f.roadClosure&&(!(f.currentSpeed as number)||!(f.freeFlowSpeed as number))))return null;
  const coordinates=(f.coordinates as {coordinate?:unknown})?.coordinate;
  if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>10000)return null;
  if(coordinates.some(c=>!c||typeof c.longitude!=='number'||typeof c.latitude!=='number'||!Number.isFinite(c.longitude)||!Number.isFinite(c.latitude)||Math.abs(c.longitude)>180||Math.abs(c.latitude)>90))return null;
  return {id,coordinates:coordinates.map(c=>[c.longitude,c.latitude]),currentSpeed:f.currentSpeed as number,freeFlowSpeed:f.freeFlowSpeed as number,currentTravelTime:f.currentTravelTime as number,freeFlowTravelTime:f.freeFlowTravelTime as number,confidence:f.confidence as number,closed:f.roadClosure,fetchedAt};
}
export async function loadTrafficSample(sample:TrafficSample,key:string,fetcher:typeof fetch=fetch):Promise<TrafficObservation|null> {
  const url=new URL('https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/16/json');
  url.searchParams.set('key',key);url.searchParams.set('point',`${sample.point[1]},${sample.point[0]}`);url.searchParams.set('unit','kmph');url.searchParams.set('thickness','1');
  const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Traffic key not authorized. Check Traffic API access in MyTomTom.':response.status===429?'Traffic provider rate limit reached. Please retry later.':'Traffic provider request failed.');
  return parseFlow(await response.json(),sample.id,new Date().toISOString());
}
