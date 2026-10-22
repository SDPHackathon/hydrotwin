import { route, type Network } from './network.ts';
export interface Demand { origin:string; destination:string; perHour:number; group:'background'|'development' }
export interface Scenario { demand:Demand[]; seed:number; minutes:number; reduction:number; capacityLink:string; capacityMultiplier:number }
export interface Snapshot { second:number; completed:number; released:number; queued:number; traveling:number; unreachable:number; queues:number[] }
export interface Result { snapshots:Snapshot[]; released:number; completed:number; unfinished:number; unreachable:number; meanSeconds:number|null; p95Seconds:number|null; meanDelay:number|null; waitingSeconds:number; peakQueue:number; developmentTrips:number }
export const congestion = (waiting:number) => waiting >= 10 ? '#dc2626' : waiting >= 3 ? '#d97706' : '#059669';
export function validateScenario(s:Scenario) {
  if(!Number.isInteger(s.seed) || !Number.isFinite(s.minutes) || s.minutes<1 || s.minutes>60 || s.reduction<0 || s.reduction>100 || !Number.isFinite(s.reduction) || !Number.isFinite(s.capacityMultiplier) || s.capacityMultiplier<1 || s.capacityMultiplier>4) throw Error('Invalid simulation settings.');
  if(s.demand.length>100 || s.demand.some(d=>!Number.isFinite(d.perHour)||d.perHour<0||d.perHour>5000||!d.origin||!d.destination)) throw Error('Invalid trip demand.');
}
export function simulate(network:Network, scenario:Scenario):Result {
  validateScenario(scenario);
  if(network.links.length>6000) throw Error('Network exceeds the tested limit of 6,000 directed segments.');
  const links=network.links, index=new Map(links.map((l,i)=>[l.id,i]));
  let randomState=scenario.seed>>>0;
  const random=()=> {randomState=(Math.imul(randomState,1664525)+1013904223)>>>0; return randomState/4294967296;};
  const end=scenario.minutes*60, horizon=end+1800;
  const trips:{depart:number;origin:string;destination:string;group:string;keep:boolean}[]=[];
  for(const d of scenario.demand) {
    const count=Math.round(d.perHour*scenario.minutes/60);
    for(let i=0;i<count;i++) trips.push({depart:Math.floor((i+random())/Math.max(1,count)*end),origin:d.origin,destination:d.destination,group:d.group,keep:d.group!=='development'||random()*100>=scenario.reduction});
  }
  if(trips.length>5000) throw Error('Reduce demand: maximum 5,000 trips per run.');
  const scheduled=trips.filter(t=>t.keep).sort((a,b)=>a.depart-b.depart);
  type Car={path:number[];step:number;ready:number;depart:number;free:number};
  const cars:Car[]=[];
  const credits=links.map(()=>0), nodeCredit=new Map<string,number>();
  const queues:Car[][]=links.map(()=>[]);
  let cursor=0, completed=0, unreachable=0, waitingSeconds=0, peakQueue=0;
  const durations:number[]=[], delays:number[]=[], snapshots:Snapshot[]=[];
  const pathCache=new Map<string,string[]|null>();
  let estimated:Record<string,number>={};
  for(let second=0;second<=horizon;second++) {
    if(second%60===0) { estimated=Object.fromEntries(links.map((l,i)=>[l.id,queues[i].length*3600/l.capacity])); pathCache.clear(); }
    while(cursor<scheduled.length && scheduled[cursor].depart<=second) {
      const t=scheduled[cursor++], key=`${t.origin}>${t.destination}`;
      if(!pathCache.has(key)) pathCache.set(key,route(network,t.origin,t.destination,estimated));
      const path=pathCache.get(key);
      if(!path) {unreachable++;continue;}
      if(!path.length) {completed++;durations.push(0);delays.push(0);continue;}
      const p=path.map(id=>index.get(id)!);
      cars.push({path:p,step:0,ready:second+Math.ceil(links[p[0]].seconds),depart:second,free:p.reduce((v,i)=>v+Math.ceil(links[i].seconds),0)});
    }
    const arriving:Car[]=[];
    for(let i=cars.length-1;i>=0;i--) if(cars[i].ready<=second) arriving.push(cars.splice(i,1)[0]);
    arriving.sort((a,b)=>a.ready-b.ready||a.depart-b.depart);
    for(const c of arriving) queues[c.path[c.step]].push(c);
    const nodes=new Map<string,number[]>();
    for(let i=0;i<links.length;i++) {
      const multiplier=String(links[i].way)===scenario.capacityLink ? scenario.capacityMultiplier : 1;
      credits[i]=Math.min(1,credits[i]+links[i].capacity*multiplier/3600);
      const incoming=nodes.get(links[i].to)??[]; incoming.push(i); nodes.set(links[i].to,incoming);
    }
    for(const [node,incoming] of nodes) {
      const capacity=Math.max(...incoming.map(i=>links[i].capacity*(String(links[i].way)===scenario.capacityLink?scenario.capacityMultiplier:1)));
      let budget=Math.min(1,(nodeCredit.get(node)??0)+capacity/3600);
      const offset=second%incoming.length;
      for(let j=0;j<incoming.length;j++) {
        const i=incoming[(j+offset)%incoming.length];
        if(budget<1 || credits[i]<1 || !queues[i].length) continue;
        const c=queues[i].shift()!; budget-=1;credits[i]-=1;c.step++;
        if(c.step===c.path.length) {completed++;const duration=second-c.depart;durations.push(duration);delays.push(Math.max(0,duration-c.free));}
        else {c.ready=second+Math.ceil(links[c.path[c.step]].seconds);cars.push(c);}
      }
      nodeCredit.set(node,budget);
    }
    const waiting=queues.reduce((v,q)=>v+q.length,0);waitingSeconds+=waiting;peakQueue=Math.max(peakQueue,...queues.map(q=>q.length));
    if(second%10===0 || second===horizon) snapshots.push({second,completed,released:cursor,queued:waiting,traveling:cars.length,unreachable,queues:queues.map(q=>q.length)});
    if(second>=end && completed+unreachable===scheduled.length) {
      if(second%10!==0) snapshots.push({second,completed,released:cursor,queued:waiting,traveling:cars.length,unreachable,queues:queues.map(q=>q.length)});
      break;
    }
  }
  durations.sort((a,b)=>a-b);
  return {snapshots,released:cursor,completed,unfinished:cursor-completed-unreachable,unreachable,meanSeconds:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,p95Seconds:durations.length?durations[Math.ceil(durations.length*.95)-1]:null,meanDelay:delays.length?delays.reduce((a,b)=>a+b,0)/delays.length:null,waitingSeconds,peakQueue,developmentTrips:scheduled.filter(t=>t.group==='development').length};
}
