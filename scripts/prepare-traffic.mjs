// Separate artifact: never regenerates flood streets, drains or seed data.
import { readFile, writeFile } from 'node:fs/promises';
import { fetchTraffic, parseOsmXml } from '../lib/generator/traffic.ts';
import { buildNetwork } from '../lib/engine/traffic/network.ts';
const slug=process.argv[2] ?? 'bukit-raja';
if(!/^[a-z0-9-]+$/.test(slug)) throw Error('Invalid township slug');
const area=JSON.parse(await readFile(new URL(`../public/data/${slug}/area.json`,import.meta.url),'utf8'));
const network=process.argv[3] ? buildNetwork(parseOsmXml(await readFile(process.argv[3],'utf8'))) : await fetchTraffic(area.bbox);
await writeFile(new URL(`../public/data/${slug}/traffic-network.json`,import.meta.url),JSON.stringify({...network,retrievedAt:new Date().toISOString(),attribution:'© OpenStreetMap contributors · ODbL'}));
console.log(`${slug}: ${network.links.length} directed segments, ${network.components} components, ${network.fingerprint}`);
