import { NextResponse } from 'next/server';
import { fetchTraffic } from '@/lib/generator/traffic';
export const runtime='nodejs';
const cache=new Map<string,{expires:number;network:Awaited<ReturnType<typeof fetchTraffic>>}>();
export async function GET(request:Request) {
  const raw=new URL(request.url).searchParams.get('bbox');
  if(!raw || !/^[-\d.,]+$/.test(raw)) return NextResponse.json({error:'Missing township extent.'},{status:400});
  const bbox=raw.split(',').map(Number);
  if(bbox.length!==4 || bbox.some(v=>!Number.isFinite(v))) return NextResponse.json({error:'Invalid township extent.'},{status:400});
  const cached=cache.get(raw);
  if(cached && cached.expires>Date.now()) return NextResponse.json(cached.network);
  try {
    const network=await fetchTraffic(bbox);
    if(cache.size>=10) cache.delete(cache.keys().next().value!);
    cache.set(raw,{expires:Date.now()+3600000,network});
    return NextResponse.json(network);
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Network preparation failed.'},{status:503});}
}
