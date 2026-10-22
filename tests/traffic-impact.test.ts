import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, type Network } from '../lib/engine/traffic/network.ts';
import { newTownship, projectedSeconds, matchObservation, assessTownship, sampleCorridors, sampleTownshipArterials, evaluateRoadDisplay, surroundingConnections, type TrafficObservation, type TrafficBaseline } from '../lib/engine/traffic/impact.ts';
import { parseFlow, validateSamples, loadTrafficSample } from '../lib/traffic/provider.ts';
const now=Date.now(),time=new Date(now).toISOString();
function network():Network {
  return buildNetwork([{type:'way',id:1,nodes:[1,2,3,4],geometry:[{lon:101,lat:3},{lon:101.005,lat:3},{lon:101.01,lat:3},{lon:101.015,lat:3}],tags:{highway:'residential',name:'Test road'}}]);
}
const observation:TrafficObservation={id:'live',coordinates:[[101,3],[101.015,3]],currentSpeed:20,freeFlowSpeed:40,currentTravelTime:100,freeFlowTravelTime:50,confidence:.9,closed:false,fetchedAt:time};
const baseline:TrafficBaseline={provider:'TomTom',retrievedAt:time,observations:[observation],requested:1,failed:0};
const proposal={...newTownship(),access:'2',size:1000,boundary:[[101.004,3],[101.005,3],[101.005,3.001]] as [number,number][]};
test('zero additional flow preserves the observed baseline; extra flow increases assumed delay',()=>{
  assert.equal(projectedSeconds(1000,20,40,0,900),180);
  assert.ok(projectedSeconds(1000,20,40,100,900)>180);
  assert.ok(projectedSeconds(1000,20,40,200,900)>projectedSeconds(1000,20,40,100,900));
});
test('directional matching rejects opposite carriageway, distant, stale and low-confidence traffic',()=>{
  const n=network(),forward=n.links.find(l=>l.from==='1'&&l.to==='2')!,reverse=n.links.find(l=>l.from==='2'&&l.to==='1')!;
  assert.ok(matchObservation(forward,[observation],now));assert.equal(matchObservation(reverse,[observation],now),null);
  assert.equal(matchObservation(forward,[{...observation,confidence:.2}],now),null);
  assert.equal(matchObservation(forward,[{...observation,fetchedAt:new Date(now-301000).toISOString()}],now),null);
  assert.equal(matchObservation(forward,[{...observation,coordinates:[[102,3],[102.01,3]]}],now),null);
});
test('impact preserves trip assignment totals and missing coverage remains unknown',()=>{
  const r=assessTownship(network(),proposal,baseline,now);
  assert.ok(Math.abs(r.tripsPerHour-r.assignedPerHour-r.unassignedPerHour)<1e-8);
  assert.ok(r.coveredRoads>0);assert.ok(r.routeCoverage<1);
  for(const road of r.roads.filter(r=>!r.observed)) {assert.equal(road.currentSeconds,null);assert.equal(road.proposedSeconds,null);}
  for(const road of r.roads.filter(r=>r.observed&&!r.closed))assert.ok(road.proposedSeconds!>=road.currentSeconds!);
});
test('closures are excluded from new-trip routes',()=>{
  const r=assessTownship(network(),proposal,{...baseline,observations:[{...observation,closed:true,currentSpeed:0}]},now);
  assert.ok(r.unassignedPerHour>0);
  assert.ok(r.roads.filter(r=>r.closed).every(r=>r.extraVehicles===0));
});
test('expired and empty observations cannot produce an assessment',()=>{
  assert.throws(()=>assessTownship(network(),proposal,{...baseline,observations:[]},now));
  assert.throws(()=>assessTownship(network(),proposal,{...baseline,retrievedAt:new Date(now-301000).toISOString()},now));
});
test('road sampling is bounded and derived from connected proposal corridors',()=>{
  const samples=sampleCorridors(network(),proposal,2);assert.ok(samples.length<=2);assert.ok(samples.every(s=>s.point.every(Number.isFinite)));
});
test('traffic request validation bounds geography, volume and inputs',()=>{
  assert.equal(validateSamples({bbox:[3,101,3.02,101.02],samples:[{id:'1',point:[101.01,3.01]}]}),true);
  assert.equal(validateSamples({bbox:[3,101,3.02,101.02],samples:[{id:'1',point:[105,3.01]}]}),false);
  assert.equal(validateSamples({bbox:[3,101,3.02,101.02],samples:Array.from({length:25},()=>({id:'1',point:[101.01,3.01]}))}),false);
});
const providerBody={flowSegmentData:{currentSpeed:20,freeFlowSpeed:40,currentTravelTime:100,freeFlowTravelTime:50,confidence:.9,roadClosure:false,coordinates:{coordinate:[{longitude:101,latitude:3},{longitude:101.01,latitude:3}]}}};
test('provider responses require valid measurements and geometry',()=>{
  assert.ok(parseFlow(providerBody,'1',time));assert.equal(parseFlow({flowSegmentData:{...providerBody.flowSegmentData,confidence:3}},'1',time),null);
  assert.equal(parseFlow({flowSegmentData:{...providerBody.flowSegmentData,currentSpeed:NaN}},'1',time),null);
});
test('provider adapter keeps the key server-side and sanitizes upstream errors',async()=>{
  let requestUrl='';
  const mock:typeof fetch=async input=>{requestUrl=String(input);return new Response(JSON.stringify(providerBody),{status:200});};
  const result=await loadTrafficSample({id:'1',point:[101,3]},'test-placeholder',mock);
  assert.ok(result);assert.equal(new URL(requestUrl).searchParams.get('point'),'3,101');assert.equal(JSON.stringify(result).includes('test-placeholder'),false);
  await assert.rejects(loadTrafficSample({id:'1',point:[101,3]},'test-placeholder',async()=>new Response('secret upstream body',{status:403})),/not authorized/);
});
test('multiple township sites are evaluated concurrently and aggregate trips across the network',()=>{
  const site1 = { ...newTownship(), name: 'Residential Site', access: '2', size: 600, tripRate: 0.5, outbound: 80, boundary: [[101.004,3],[101.005,3],[101.005,3.001]] as [number,number][] };
  const site2 = { ...newTownship(), name: 'Commercial Hub', kind: 'commercial' as const, access: '3', size: 10000, tripRate: 2, outbound: 30, boundary: [[101.008,3],[101.01,3],[101.01,3.001]] as [number,number][] };
  const multiResult = assessTownship(network(), [site1, site2], baseline, now);
  assert.equal(multiResult.tripsPerHour, 300 + 200);
  assert.ok(multiResult.assignedPerHour > 0);
  assert.ok(multiResult.affectedRoads > 0);
  const sampleList = sampleCorridors(network(), [site1, site2], 5);
  assert.ok(sampleList.length > 0 && sampleList.length <= 5);
});
test('evaluateRoadDisplay strictly paints unobserved roads grey, closed dark red, and live speeds accurately',()=>{
  const n = network(), link = n.links[0];
  const unobserved = evaluateRoadDisplay(link, null, null, 'current', 'speed', false);
  assert.equal(unobserved.color, '#a8a29e');
  assert.equal(unobserved.status, 'unknown');
  assert.equal(unobserved.isObserved, false);

  const closed = evaluateRoadDisplay(link, { ...observation, closed: true }, null, 'current', 'speed', false);
  assert.equal(closed.color, '#7f1d1d');
  assert.equal(closed.status, 'closed');

  const freeFlow = evaluateRoadDisplay(link, { ...observation, currentSpeed: 38, freeFlowSpeed: 40 }, null, 'current', 'speed', false);
  assert.equal(freeFlow.color, '#059669');
  assert.equal(freeFlow.status, 'freeflow');

  const slower = evaluateRoadDisplay(link, { ...observation, currentSpeed: 24, freeFlowSpeed: 40 }, null, 'current', 'speed', false);
  assert.equal(slower.color, '#d97706');
  assert.equal(slower.status, 'slower');

  const congested = evaluateRoadDisplay(link, { ...observation, currentSpeed: 12, freeFlowSpeed: 40 }, null, 'current', 'speed', false);
  assert.equal(congested.color, '#dc2626');
  assert.equal(congested.status, 'congested');

  const delta = evaluateRoadDisplay(link, null, { id: link.id, name: link.name, extraVehicles: 150, observed: false, observationId: null, currentSeconds: null, proposedSeconds: null, currentSpeed: null, proposedSpeed: null, confidence: null, closed: false }, 'proposed', 'delta', false);
  assert.equal(delta.color, '#f59e0b');
});
test('sampleTownshipArterials spreads samples across unique ways and is bounded by limit',()=>{
  const n = network();
  const arterials = sampleTownshipArterials(n, 2);
  assert.ok(arterials.length > 0 && arterials.length <= 2);
  assert.ok(arterials.every(a => Number.isFinite(a.point[0]) && Number.isFinite(a.point[1])));
});
test('surroundingConnections assigns valid destination weights summing to 1.0',()=>{
  const n = network();
  const conns = surroundingConnections(n, proposal);
  assert.ok(conns.length > 0);
  const totalWeight = conns.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(totalWeight - 1.0) < 1e-6);
});

