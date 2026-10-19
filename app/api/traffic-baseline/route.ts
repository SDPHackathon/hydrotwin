import { NextResponse } from 'next/server';
import { loadTrafficSample, validateSamples } from '@/lib/traffic/provider';
import type { TrafficObservation } from '@/lib/engine/traffic/impact';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
let nextAllowedAt=0;
export async function GET() {
  return NextResponse.json({provider:'TomTom',configured:!!process.env.TOMTOM_TRAFFIC_API_KEY,maxSamples:24},{headers});
}
export async function POST(request:Request) {
  const key=process.env.TOMTOM_TRAFFIC_API_KEY;
  if(!key)return NextResponse.json({code:'not_configured',error:'Add TOMTOM_TRAFFIC_API_KEY to .env.local and restart the server to connect current traffic.'},{status:503,headers});
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)return NextResponse.json({error:'Cross-origin traffic requests are not allowed.'},{status:403,headers});
  if(Number(request.headers.get('content-length')??0)>16000)return NextResponse.json({error:'Traffic request too large.'},{status:413,headers});
  let body:unknown;
  try {const raw=await request.text();if(raw.length>16000)throw Error();body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid traffic request.'},{status:400,headers});}
  if(!validateSamples(body))return NextResponse.json({error:'Choose a valid township and up to 24 nearby road samples.'},{status:400,headers});
  if(Date.now()<nextAllowedAt)return NextResponse.json({error:'Wait 10 seconds between traffic refreshes.'},{status:429,headers:{...headers,'Retry-After':String(Math.ceil((nextAllowedAt-Date.now())/1000))}});
  nextAllowedAt=Date.now()+10000;
  const observations:TrafficObservation[]=[];let providerError='';
  for(let i=0;i<body.samples.length;i+=4) {
    const group=await Promise.allSettled(body.samples.slice(i,i+4).map(sample=>loadTrafficSample(sample,key)));
    for(const item of group) {if(item.status==='fulfilled'&&item.value)observations.push(item.value);else if(item.status==='rejected'&&item.reason instanceof Error&&/^(Traffic key|Traffic provider)/.test(item.reason.message))providerError=item.reason.message;}
    if(providerError.startsWith('Traffic key')||providerError.includes('rate limit'))break;
  }
  if(!observations.length)return NextResponse.json({error:providerError||'No current traffic was returned for these road connections. Try another site or retry later.'},{status:502,headers});
  return NextResponse.json({provider:'TomTom',retrievedAt:new Date().toISOString(),observations,requested:body.samples.length,failed:body.samples.length-observations.length},{headers});
}
