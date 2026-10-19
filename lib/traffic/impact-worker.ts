import { assessTownship, type TownshipProposal, type TrafficBaseline } from '../engine/traffic/impact.ts';
import type { Network } from '../engine/traffic/network.ts';
self.onmessage=(event:MessageEvent<{network:Network;proposal:TownshipProposal|TownshipProposal[];baseline:TrafficBaseline}>)=>{
  try {self.postMessage({result:assessTownship(event.data.network,event.data.proposal,event.data.baseline,Date.now())});}
  catch(error) {self.postMessage({error:error instanceof Error?error.message:'Township assessment failed.'});}
};
