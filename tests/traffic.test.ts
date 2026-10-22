import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, route, type OsmElement } from '../lib/engine/traffic/network.ts';
import { simulate, type Scenario } from '../lib/engine/traffic/sim.ts';
import { makeScenario, defaultDraft, suggestAccess } from '../lib/engine/traffic/scenario.ts';
function road(id:number,nodes:number[],tags:Record<string,string>={}):OsmElement {return {type:'way',id,nodes,tags:{highway:'residential',...tags},geometry:nodes.map(n=>({lat:3,lon:101+n*.001}))};}
const scenario:Scenario={seed:42,minutes:2,reduction:0,capacityLink:'',capacityMultiplier:1,demand:[{origin:'1',destination:'3',perHour:600,group:'background'}]};
test('vehicle one-way and reverse geometry are respected',()=>{
  const n=buildNetwork([road(1,[1,2],{oneway:'yes'}),road(2,[2,3],{oneway:'-1'})]);
  assert.ok(route(n,'1','2'));assert.equal(route(n,'2','1'),null);assert.ok(route(n,'3','2'));assert.equal(route(n,'2','3'),null);
});
test('crossing geometries without shared nodes and private roads do not connect',()=>{
  const n=buildNetwork([road(1,[1,2]),road(2,[3,4]),road(3,[2,3],{access:'private'})]);
  assert.equal(n.components,2);assert.equal(route(n,'1','4'),null);
});
test('prohibited turns enforced by incoming-link state',()=>{
  const restriction:OsmElement={type:'relation',id:10,tags:{type:'restriction',restriction:'no_right_turn'},members:[{type:'way',ref:1,role:'from'},{type:'way',ref:2,role:'to'},{type:'node',ref:2,role:'via'}]};
  const n=buildNetwork([road(1,[1,2],{oneway:'yes'}),road(2,[2,3],{oneway:'yes'}),restriction]);
  assert.equal(route(n,'1','3'),null);
});
test('queues conserve vehicles at every recorded step and runs are reproducible',()=>{
  const n=buildNetwork([road(1,[1,2,3])]);n.links.forEach(l=>l.capacity=120);
  const a=simulate(n,scenario), b=simulate(n,scenario);
  assert.deepEqual(a,b);assert.ok(a.peakQueue>0);
  for(const s of a.snapshots) assert.equal(s.released,s.completed+s.queued+s.traveling+s.unreachable);
  assert.equal(a.released,a.completed+a.unfinished+a.unreachable);
});
test('zero demand has unavailable journey statistics',()=>{
  const r=simulate(buildNetwork([road(1,[1,2])]),{...scenario,demand:[]});
  assert.equal(r.completed,0);assert.equal(r.meanSeconds,null);assert.equal(r.peakQueue,0);
});
test('unreachable demand remains explicitly accounted for',()=>{
  const r=simulate(buildNetwork([road(1,[1,2])]),scenario);
  assert.equal(r.unreachable,r.released);assert.equal(r.meanSeconds,null);
});
test('completed free-flow trip takes at least link traversal time',()=>{
  const n=buildNetwork([road(1,[1,2,3])]);const r=simulate(n,{...scenario,demand:[{...scenario.demand[0],perHour:30}]});
  assert.equal(r.completed,1);assert.ok(r.meanSeconds!>=n.links.filter(l=>l.id.endsWith(':1')).reduce((s,l)=>s+Math.ceil(l.seconds),0));
});
test('development reduction preserves background releases',()=>{
  const n=buildNetwork([road(1,[1,2,3])]);const s={...scenario,demand:[...scenario.demand,{...scenario.demand[0],group:'development' as const}]};
  const a=simulate(n,s),b=simulate(n,{...s,reduction:100});
  assert.equal(b.developmentTrips,0);assert.equal(a.released-b.released,a.developmentTrips);
});
test('housing and commercial generation use vehicle rates once',()=>{
  const d={...defaultDraft,origin:'1',destination:'3',access:'2',boundary:[[101,3],[101.001,3],[101.001,3.001]] as [number,number][]};
  assert.equal(makeScenario(d).demand.filter(x=>x.group==='development').reduce((s,x)=>s+x.perHour,0),150);
  assert.equal(makeScenario({...d,kind:'commercial',size:10000,rate:2}).demand.filter(x=>x.group==='development').reduce((s,x)=>s+x.perHour,0),200);
});
test('invalid numbers and oversized scenarios fail explicitly',()=>{
  const n=buildNetwork([road(1,[1,2,3])]);assert.throws(()=>simulate(n,{...scenario,minutes:NaN}));assert.throws(()=>simulate(n,{...scenario,reduction:101}));
});
test('site suggestions do not invent remote road connections',()=>{
  assert.equal(suggestAccess(buildNetwork([road(1,[1,2,3])]),[[105,4],[105.1,4],[105,4.1]],'3'),'');
});
