import { buildNetwork, type OsmElement } from '../engine/traffic/network.ts';
// OSM's map endpoint returns simple, flat XML elements. No DTD/entities are evaluated.
export function parseOsmXml(xml:string):OsmElement[] {
  const attrs=(s:string)=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')]));
  const positions=new Map<number,{lat:number;lon:number}>();
  for(const m of xml.matchAll(/<node\s+([^>]*?)(?:\/>|>[\s\S]*?<\/node>)/g)) {const a=attrs(m[1]);positions.set(Number(a.id),{lat:Number(a.lat),lon:Number(a.lon)});}
  const elements:OsmElement[]=[];
  for(const m of xml.matchAll(/<(way|relation)\s+([^>]+)>([\s\S]*?)<\/(?:way|relation)>/g)) {
    const tags=Object.fromEntries([...m[3].matchAll(/<tag\s+([^>]+)\/>/g)].map(t=>{const a=attrs(t[1]);return[a.k,a.v];}));
    const id=Number(attrs(m[2]).id);
    if(m[1]==='way') {const nodes=[...m[3].matchAll(/<nd\s+([^>]+)\/>/g)].map(t=>Number(attrs(t[1]).ref));if(nodes.every(n=>positions.has(n)))elements.push({type:'way',id,tags,nodes,geometry:nodes.map(n=>positions.get(n)!)});}
    else elements.push({type:'relation',id,tags,members:[...m[3].matchAll(/<member\s+([^>]+)\/>/g)].map(t=>{const a=attrs(t[1]);return{type:a.type,ref:Number(a.ref),role:a.role};})});
  }
  const eligible=/^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/;
  return elements.filter(e=>e.type==='relation'||eligible.test(e.tags?.highway??''));
}
export async function fetchTraffic(bbox:number[]) {
  const [s,w,n,e]=bbox;
  if(bbox.length!==4 || bbox.some(v=>!Number.isFinite(v)) || s>=n || w>=e || Math.abs(s)>85 || Math.abs(n)>85 || Math.abs(w)>180 || Math.abs(e)>180 || n-s>.055 || e-w>.055) throw Error('Choose a township extent smaller than approximately 6 km.');
  const box=[s-.001,w-.001,n+.001,e+.001].join(',');
  const query=`[out:json][timeout:30];way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${box})->.roads;(.roads;rel(bw.roads)[type=restriction];);out geom;`;
  try {
    const response=await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${[w,s,e,n].join(',')}`,{headers:{'User-Agent':'HydroTwin/0.1'},signal:AbortSignal.timeout(15000)});
    if(response.ok) {const network=buildNetwork(parseOsmXml(await response.text()));if(network.links.length)return network;}
  } catch { /* use the buffered Overpass extract below */ }
  let lastError='';
  for(const endpoint of ['https://overpass.openstreetmap.fr/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']) {
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'HydroTwin/0.1'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(35000)});
      if(!response.ok) {lastError=`HTTP ${response.status}`;continue;}
      const body=await response.json() as {elements:OsmElement[]};
      if(body.elements?.length>50000) throw Error('Traffic extract too large.');
      const network=buildNetwork(body.elements);
      if(!network.links.length) throw Error('No eligible vehicle roads found.');
      return network;
    } catch(error) {lastError=error instanceof Error?error.message:'Network error';}
  }
  throw Error(`OpenStreetMap traffic data is unavailable (${lastError}). Retry when connected; flood modes remain available.`);
}
