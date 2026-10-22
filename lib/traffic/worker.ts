import { simulate, type Scenario } from '../engine/traffic/sim.ts';
import type { Network } from '../engine/traffic/network.ts';
self.onmessage = (event:MessageEvent<{network:Network;scenario:Scenario}>) => {
  try {
    const {network,scenario}=event.data;
    const existing=simulate(network,{...scenario,demand:scenario.demand.filter(d=>d.group==='background'),reduction:0,capacityLink:''});
    const developed=simulate(network,{...scenario,reduction:0,capacityLink:''});
    const mitigated=simulate(network,scenario);
    self.postMessage({results:[existing,developed,mitigated]});
  } catch(error) {self.postMessage({error:error instanceof Error?error.message:'Simulation failed.'});}
};
