"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Area } from '@/lib/area';
import TownshipMap from './TownshipMap';
import MapTownshipNavigation from './MapTownshipNavigation';
import { boundaryError, siteAreaHa } from '@/lib/engine/development';
import { anchors } from '@/lib/engine/traffic/scenario';
import type { Network } from '@/lib/engine/traffic/network';
import {
  additionalTrips,
  automaticAccess,
  evaluateRoadDisplay,
  matchObservation,
  newTownship,
  proposalError,
  sampleCorridors,
  sampleTownshipArterials,
  type ImpactResult,
  type TownshipProposal,
  type TrafficBaseline
} from '@/lib/engine/traffic/impact';
import './TrafficWorkspace.css';

export interface TownshipSite extends TownshipProposal {
  id: string;
  color: string;
}

interface Props {
  area: Area;
  buildings?: GeoJSON.FeatureCollection;
  townships: (Area | { slug: string; name: string; custom?: boolean })[];
  onSelect: (slug: string) => void;
  onDownload: () => void;
  onFlood: () => void;
}

interface SavedMultiProposal {
  id: string;
  version: 3;
  name: string;
  sites: TownshipSite[];
}

const SITE_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#8b5cf6', // Violet
  '#0284c7', // Sky Blue
];

const emptyStreets = { type: 'FeatureCollection' as const, features: [] };
const rounded = (n: number) => Math.round(n).toLocaleString();

export default function TrafficWorkspace({
  area,
  buildings,
  townships,
  onSelect,
  onDownload,
  onFlood
}: Props) {
  const [network, setNetwork] = useState<Network | null>(null);
  const [sites, setSites] = useState<TownshipSite[]>([
    { ...newTownship(), id: 'site-1', name: 'Site 1', color: SITE_COLORS[0] }
  ]);
  const [activeSiteId, setActiveSiteId] = useState<string>('site-1');

  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState('');
  const [retry, setRetry] = useState(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [baseline, setBaseline] = useState<TrafficBaseline | null>(null);
  const [assessment, setAssessment] = useState<{ input: string; result: ImpactResult } | null>(null);
  const [view, setView] = useState<'current' | 'proposed'>('current');
  const [metricView, setMetricView] = useState<'speed' | 'delta'>('speed');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [accessManual, setAccessManual] = useState(false);
  const [pickingAccess, setPickingAccess] = useState(false);
  const [saved, setSaved] = useState<SavedMultiProposal[]>([]);
  const [expired, setExpired] = useState(false);

  const worker = useRef<Worker | null>(null);
  const request = useRef<AbortController | null>(null);
  const runId = useRef(0);

  const key = `hydrotwin_township_impact_v3_${area.slug}`;
  const legacyKey = `hydrotwin_township_impact_v2_${area.slug}`;

  const activeSite = sites.find(s => s.id === activeSiteId) || sites[0];

  const input = JSON.stringify(sites);
  const stale = !!assessment && assessment.input !== input;
  const result = !stale && !expired ? assessment?.result : null;
  const nodes = useMemo(() => (network ? anchors(network) : []), [network]);
  const mapArea = useMemo(() => ({ ...area, attribution: '© OpenStreetMap contributors (ODbL)' }), [area]);

  const validSites = useMemo(() => sites.filter(s => s.boundary.length >= 3 && s.access), [sites]);
  const activeProblem = network ? proposalError(activeSite, network, area.bbox) : null;
  const allProblems = network ? proposalError(validSites.length ? validSites : [activeSite], network, area.bbox) : null;

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/traffic-baseline', { signal: controller.signal })
      .then(r => r.json())
      .then(s => setConfigured(s.configured === true))
      .catch(() => {
        if (!controller.signal.aborted) setConfigured(false);
      });

    const load = async () => {
      try {
        setBaseline(null);
        setAssessment(null);
        setSelected('');
        let response = await fetch(`/data/${area.slug}/traffic-network.json`, { signal: controller.signal });
        if (!response.ok) response = await fetch(`/api/traffic-network?bbox=${area.bbox.join(',')}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'Could not prepare surrounding roads.');
        if (body.version !== 1 || !Array.isArray(body.links) || !body.links.length) throw Error('No usable road network was returned.');
        setNetwork(body);
        setLoading(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setNetworkError(e instanceof Error ? e.message : 'Could not load roads.');
          setLoading(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [area, retry]);

  // Initial baseline acquisition: sample arterials across the township immediately when network is ready
  useEffect(() => {
    if (!network || configured !== true || baseline) return;
    const controller = new AbortController();
    const fetchInitialBaseline = async () => {
      try {
        const samples = sampleTownshipArterials(network, 24);
        if (!samples.length) return;
        const res = await fetch('/api/traffic-baseline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bbox: area.bbox, samples }),
          signal: controller.signal
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted && data.observations?.length) {
          setBaseline(data as TrafficBaseline);
          setExpired(false);
        }
      } catch {
        // Keep offline baseline gracefully if initial fetch fails
      }
    };
    void fetchInitialBaseline();
    return () => controller.abort();
  }, [network, configured, area.bbox, baseline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(value) && value.length) {
          setSaved(
            value.filter(
              (v): v is SavedMultiProposal =>
                v?.version === 3 &&
                typeof v?.id === 'string' &&
                typeof v?.name === 'string' &&
                Array.isArray(v.sites)
            ).slice(0, 30)
          );
          return;
        }

        // Migrate legacy single proposals
        const legacy: unknown = JSON.parse(localStorage.getItem(legacyKey) ?? '[]');
        if (Array.isArray(legacy)) {
          const migrated: SavedMultiProposal[] = legacy
            .filter(v => v?.version === 2 && v.proposal)
            .map(v => ({
              id: v.id,
              version: 3 as const,
              name: v.name,
              sites: [{ ...v.proposal, id: 'site-1', color: SITE_COLORS[0] }]
            }));
          setSaved(migrated);
        }
      } catch {
        setMessage('Saved township proposals could not be read.');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, legacyKey]);

  useEffect(() => () => {
    request.current?.abort();
    worker.current?.terminate();
  }, []);

  useEffect(() => {
    if (!baseline) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, 300000 - (Date.now() - Date.parse(baseline.retrievedAt)))
    );
    return () => window.clearTimeout(timer);
  }, [baseline]);

  // Map real observations directly to network links using directional & endpoint matching
  const observations = useMemo(() => {
    if (!network || !baseline || expired || !baseline.observations.length) return new Map();
    const snapshotTime = Date.parse(baseline.retrievedAt) || 0;
    return new Map(network.links.map(l => [l.id, matchObservation(l, baseline.observations, snapshotTime)]));
  }, [network, baseline, expired]);

  const resultRoads = useMemo(() => new Map(result?.roads.map(r => [r.id, r]) ?? []), [result]);

  const trafficData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: network?.links.map(l => {
      const o = observations.get(l.id);
      const r = resultRoads.get(l.id);
      const display = evaluateRoadDisplay(l, o, r, view, metricView, selected === l.id);

      return {
        type: 'Feature',
        properties: { id: l.id, color: display.color, width: display.width, casingWidth: display.casingWidth },
        geometry: { type: 'LineString', coordinates: l.coordinates }
      };
    }) ?? []
  }), [network, observations, resultRoads, view, metricView, selected]);

  const cancel = () => {
    runId.current++;
    request.current?.abort();
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };

  const updateActiveSite = (patch: Partial<TownshipSite>) => {
    cancel();
    setSites(prev => prev.map(s => (s.id === activeSite.id ? { ...s, ...patch } : s)));
    setView('current');
  };

  const addSite = () => {
    if (sites.length >= 6) {
      setMessage('Maximum 6 sites supported at once.');
      return;
    }
    const nextIdx = sites.length + 1;
    const newId = `site-${Date.now()}`;
    const newColor = SITE_COLORS[sites.length % SITE_COLORS.length];
    const created: TownshipSite = {
      ...newTownship(),
      id: newId,
      name: `Site ${nextIdx}`,
      color: newColor,
    };
    cancel();
    setSites(prev => [...prev, created]);
    setActiveSiteId(newId);
    setDrawing(true);
    setPickingAccess(false);
    setMessage(`Started ${created.name}. Click map to draw its boundary corners.`);
  };

  const removeSite = (id: string) => {
    if (sites.length <= 1) return;
    cancel();
    setSites(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeSiteId === id) setActiveSiteId(next[0].id);
      return next;
    });
    setMessage('Site removed.');
  };

  const finishDrawing = () => {
    const invalid = boundaryError(activeSite.boundary);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    setDrawing(false);
    setAccessManual(false);
    updateActiveSite({ access: network ? automaticAccess(network, activeSite.boundary) : '' });
    setMessage(`${activeSite.name} boundary completed. Nearest road connection suggested.`);
  };

  const assess = async () => {
    if (!network || allProblems || drawing) return;
    const targets = validSites.length ? validSites : [activeSite];
    cancel();
    const id = runId.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setMessage(`Reading current traffic for ${targets.length} site corridor(s) across the township…`);

    try {
      const samples = sampleCorridors(network, targets, 24);
      if (!samples.length) throw Error('No surrounding connections are reachable. Choose another site entrance.');

      let current = baseline;
      if (!current || expired) {
        const response = await fetch('/api/traffic-baseline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bbox: area.bbox, samples }),
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Current traffic could not be retrieved.');
        if (runId.current !== id) return;
        current = data as TrafficBaseline;
        setBaseline(current);
        setExpired(false);
      } else {
        try {
          const response = await fetch('/api/traffic-baseline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bbox: area.bbox, samples }),
            signal: controller.signal
          });
          if (response.ok) {
            const data = await response.json();
            if (runId.current === id && data.observations?.length) {
              const mergedMap = new Map(current.observations.map(o => [o.id, o]));
              for (const o of data.observations) mergedMap.set(o.id, o);
              current = { ...data, observations: [...mergedMap.values()] };
              setBaseline(current);
              setExpired(false);
            }
          }
        } catch {
          // Proceed with existing active baseline
        }
      }

      if (runId.current !== id || !current) return;
      setMessage('Distributing trips across the entire township network and computing delays…');

      const w = new Worker(new URL('../lib/traffic/impact-worker.ts', import.meta.url));
      worker.current = w;
      w.onmessage = e => {
        if (runId.current !== id) return;
        if (e.data.error) {
          setError(e.data.error);
        } else {
          setAssessment({ input, result: e.data.result });
          setView('proposed');
          setMessage('Assessment complete. Compare current traffic with the township-wide impact.');
        }
        setBusy(false);
        w.terminate();
        worker.current = null;
      };
      w.onerror = () => {
        if (runId.current === id) {
          setError('The impact calculation failed. Please retry.');
          setBusy(false);
        }
        w.terminate();
      };
      w.postMessage({ network, proposal: targets, baseline: current });
    } catch (e) {
      if (!controller.signal.aborted && runId.current === id) {
        setError(e instanceof Error ? e.message : 'Assessment failed.');
        setBusy(false);
        setMessage('');
      }
    }
  };

  const save = () => {
    if (allProblems) return;
    const targets = validSites.length ? validSites : sites;
    const next: SavedMultiProposal[] = [
      {
        id: crypto.randomUUID(),
        version: 3 as const,
        name: targets.map(s => s.name).join(' + ') || 'Township proposal',
        sites: targets
      },
      ...saved
    ].slice(0, 30);

    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSaved(next);
      setMessage('Proposal saved on this device.');
    } catch {
      setMessage('Device storage is unavailable or full.');
    }
  };

  const link = network?.links.find(l => l.id === selected);
  const observation = observations.get(selected);
  const road = resultRoads.get(selected);
  const affected =
    result?.roads
      .filter(r => r.extraVehicles > 0.01)
      .sort((a, b) => (b.extraVehicles) - (a.extraVehicles))
      .slice(0, 10) ?? [];

  return (
    <div className="traffic-workspace">
      <div className="traffic-map">
        <TownshipMap
          area={mapArea}
          drains={[]}
          streets={emptyStreets}
          statuses={{}}
          buildings={buildings}
          trafficData={trafficData}
          sites={sites.map(s => ({
            id: s.id,
            name: s.name,
            boundary: s.boundary,
            color: s.color,
            access: s.access,
            closed: !drawing || s.id !== activeSite.id
          }))}
          onTrafficPick={id => {
            if (drawing) return;
            setSelected(id);
            if (pickingAccess && network) {
              const l = network.links.find(linkItem => linkItem.id === id);
              if (l) {
                updateActiveSite({ access: l.from });
                setAccessManual(true);
                setPickingAccess(false);
              }
            }
          }}
          onSitePick={
            drawing
              ? p => {
                  if (activeSite.boundary.length < 50) {
                    updateActiveSite({ boundary: [...activeSite.boundary, p] });
                  }
                }
              : undefined
          }
        />
        <MapTownshipNavigation current={area} townships={townships} onSelect={onSelect} onDownload={onDownload} />
        <div className="traffic-map-key">
          <div className="flex items-center justify-between gap-4">
            <strong>
              {metricView === 'delta'
                ? 'Added Vehicle Flow (Whole-Township Heatmap)'
                : view === 'proposed' && result
                ? 'Estimated Traffic with Township'
                : 'Current Baseline Traffic (Live & Modeled)'}
            </strong>
            <div className="traffic-metric-switch">
              <button aria-pressed={metricView === 'speed'} onClick={() => setMetricView('speed')}>
                Congestion
              </button>
              <button aria-pressed={metricView === 'delta'} onClick={() => setMetricView('delta')}>
                Flow Delta
              </button>
            </div>
          </div>
          {metricView === 'delta' ? (
            <span>
              <i style={{ background: '#e7e5e4' }} /> No added trips{' '}
              <i style={{ background: '#06b6d4' }} /> +10–30 veh/h{' '}
              <i style={{ background: '#3b82f6' }} /> +30–90 veh/h{' '}
              <i style={{ background: '#f59e0b' }} /> +90–220 veh/h{' '}
              <i style={{ background: '#dc2626' }} /> +220+ veh/h
            </span>
          ) : (
            <span>
              <i style={{ background: '#059669' }} /> Moving (≥70%){' '}
              <i style={{ background: '#d97706' }} /> Slower (40–70%){' '}
              <i style={{ background: '#dc2626' }} /> Congested (&lt;40%){' '}
              <i style={{ background: '#7f1d1d' }} /> Closed{' '}
              <i style={{ background: '#a8a29e' }} /> Unobserved
            </span>
          )}
          <small>
            {metricView === 'delta'
              ? 'Modeled development trip volume across the entire township road network.'
              : baseline && !expired
              ? 'Real TomTom observations shown where sampled. Unobserved streets remain grey (view added load in Flow Delta).'
              : 'Unobserved streets remain grey until real traffic baseline is connected.'}
          </small>
        </div>
      </div>

      <aside className="traffic-panel">
        <header>
          <span className="traffic-eyebrow">HydroTwin / Township planning</span>
          <h1>Township impact</h1>
          <p>Draw multiple sites to evaluate whole-township traffic distribution and bottlenecks.</p>
        </header>

        <div className="traffic-switch" aria-label="Analysis domain">
          <button onClick={onFlood}>Flood</button>
          <button aria-pressed="true">Traffic</button>
        </div>

        <div className={`traffic-connection ${configured ? 'is-connected' : ''}`} role="status">
          <span className="traffic-status-dot" />
          <div>
            <strong>{configured === null ? 'Checking traffic connection…' : configured ? 'TomTom key configured' : 'Connect real traffic'}</strong>
            <p>
              {configured
                ? 'Key active. Primary corridors match live TomTom speeds; interior streets model standard free-flow.'
                : 'A server API key enables live traffic observations. When disconnected, full network models standard free-flow.'}
            </p>
          </div>
        </div>

        {configured === false && (
          <details open className="traffic-setup">
            <summary>Set up the traffic connection</summary>
            <ol>
              <li>
                Sign in at <a href="https://my.tomtom.com/" target="_blank" rel="noreferrer">MyTomTom</a> and open API &amp; SDK Keys.
              </li>
              <li>
                Add <code>TOMTOM_TRAFFIC_API_KEY</code> to <code>.env.local</code>.
              </li>
              <li>Restart the development server, then reopen Traffic.</li>
            </ol>
          </details>
        )}

        {loading ? (
          <section>
            <h2>Loading surrounding roads…</h2>
          </section>
        ) : !network ? (
          <section>
            <p role="alert">{networkError}</p>
            <button
              onClick={() => {
                setLoading(true);
                setNetworkError('');
                setRetry(x => x + 1);
              }}
            >
              Retry road preparation
            </button>
          </section>
        ) : (
          <>
            <section>
              <span className="traffic-step">01 / Development sites</span>
              <div className="flex items-center justify-between">
                <h2>Township Sites ({sites.length})</h2>
                <button type="button" className="traffic-site-add" onClick={addSite}>
                  + Add site
                </button>
              </div>
              <p>Draw multiple parcels to simulate phased or mixed developments together.</p>

              <div className="traffic-site-tabs">
                {sites.map(s => (
                  <button
                    type="button"
                    key={s.id}
                    className={`traffic-site-chip ${s.id === activeSite.id ? 'is-active' : ''}`}
                    onClick={() => {
                      cancel();
                      setActiveSiteId(s.id);
                      setDrawing(false);
                      setPickingAccess(false);
                    }}
                  >
                    <span className="traffic-site-color-dot" style={{ background: s.color }} />
                    {s.name} ({s.kind === 'housing' ? `${rounded(s.size)} homes` : `${rounded(s.size)} m²`})
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-stone-800" style={{ color: activeSite.color }}>
                    Editing: {activeSite.name}
                  </strong>
                  {sites.length > 1 && (
                    <button type="button" className="traffic-site-delete" onClick={() => removeSite(activeSite.id)}>
                      Delete {activeSite.name}
                    </button>
                  )}
                </div>

                <div className="traffic-actions mt-2">
                  <button
                    className="traffic-primary"
                    onClick={() => {
                      updateActiveSite({ boundary: [], access: '' });
                      setDrawing(true);
                      setPickingAccess(false);
                    }}
                  >
                    {activeSite.boundary.length ? 'Redraw boundary' : 'Draw site outline'}
                  </button>
                  {drawing && (
                    <>
                      <button onClick={() => updateActiveSite({ boundary: activeSite.boundary.slice(0, -1) })}>
                        Undo
                      </button>
                      <button onClick={finishDrawing}>Finish outline</button>
                    </>
                  )}
                  {activeSite.boundary.length > 0 && !drawing && (
                    <button onClick={() => updateActiveSite({ boundary: [], access: '' })}>Clear</button>
                  )}
                </div>

                {activeSite.boundary.length > 0 && (
                  <p>
                    {activeSite.boundary.length} corners
                    {activeSite.boundary.length >= 3 ? ` · ${siteAreaHa(activeSite.boundary).toFixed(2)} hectares` : ''}
                    {drawing ? ' · click map to place corners' : ''}
                  </p>
                )}
                {activeProblem && activeSite.boundary.length > 0 && !drawing && (
                  <p className="traffic-notice">{activeProblem}</p>
                )}

                {!drawing && activeSite.boundary.length >= 3 && (
                  <>
                    <label>
                      Road connection · {accessManual ? 'manually adjusted' : 'automatically suggested'}
                      <select
                        value={activeSite.access}
                        onChange={e => {
                          updateActiveSite({ access: e.target.value });
                          setAccessManual(true);
                        }}
                      >
                        <option value="">Choose a road connection</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.name} · {n.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="traffic-actions">
                      <button onClick={() => setPickingAccess(p => !p)}>
                        {pickingAccess ? 'Cancel road selection' : 'Choose road on map'}
                      </button>
                      <button
                        onClick={() => {
                          updateActiveSite({ access: automaticAccess(network, activeSite.boundary) });
                          setAccessManual(false);
                        }}
                      >
                        Restore suggestion
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section>
              <span className="traffic-step">02 / Site details &amp; trips</span>
              <h2>Parameters for {activeSite.name}</h2>
              <label>
                Site name
                <input value={activeSite.name} maxLength={80} onChange={e => updateActiveSite({ name: e.target.value })} />
              </label>
              <label>
                Development use
                <select
                  value={activeSite.kind}
                  onChange={e =>
                    updateActiveSite({
                      kind: e.target.value as TownshipProposal['kind'],
                      size: e.target.value === 'housing' ? 500 : 8000,
                      tripRate: e.target.value === 'housing' ? 0.5 : 2
                    })
                  }
                >
                  <option value="housing">Housing township</option>
                  <option value="commercial">Commercial development</option>
                </select>
              </label>
              <label>
                {activeSite.kind === 'housing' ? 'Number of homes' : 'Gross floor area (m²)'}
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={Number.isFinite(activeSite.size) ? activeSite.size : ''}
                  onChange={e => updateActiveSite({ size: e.target.valueAsNumber })}
                />
              </label>

              <div className="traffic-trip-estimate">
                <strong>
                  {Number.isFinite(additionalTrips(activeSite)) ? rounded(additionalTrips(activeSite)) : '—'}
                </strong>
                <span>
                  trips/hour from {activeSite.name} (
                  {rounded(sites.reduce((acc, s) => acc + (additionalTrips(s) || 0), 0))} total all sites)
                </span>
              </div>

              <details>
                <summary>Adjust trip-generation assumptions</summary>
                <div style={{ marginTop: '8px' }}>
                  <small style={{ fontWeight: 600, color: '#57534e' }}>Trip generation presets</small>
                  <div className="traffic-presets">
                    {activeSite.kind === 'housing' ? (
                      <>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 0.35 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 0.35 })}
                        >
                          Low (0.35)
                        </button>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 0.5 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 0.5 })}
                        >
                          Base (0.50)
                        </button>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 0.8 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 0.8 })}
                        >
                          High (0.80)
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 1.5 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 1.5 })}
                        >
                          Low (1.5)
                        </button>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 2.0 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 2.0 })}
                        >
                          Base (2.0)
                        </button>
                        <button
                          type="button"
                          className={`traffic-preset-btn ${activeSite.tripRate === 3.0 ? 'is-active' : ''}`}
                          onClick={() => updateActiveSite({ tripRate: 3.0 })}
                        >
                          High (3.0)
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <label>
                  {activeSite.kind === 'housing' ? 'Vehicle trips per home per hour' : 'Vehicle trips per 100 m² per hour'}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.05"
                    value={Number.isFinite(activeSite.tripRate) ? activeSite.tripRate : ''}
                    onChange={e => updateActiveSite({ tripRate: e.target.valueAsNumber })}
                  />
                </label>
                <label>
                  Outbound share (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number.isFinite(activeSite.outbound) ? activeSite.outbound : ''}
                    onChange={e => updateActiveSite({ outbound: e.target.valueAsNumber })}
                  />
                </label>
              </details>
            </section>

            <section>
              <span className="traffic-step">03 / Township impact calculation</span>
              <h2>Calculate whole township</h2>
              <p>Simulates trip dispersion across internal hubs, schools, and regional gateways with dynamic delay feedback.</p>

              {allProblems && <p className="traffic-notice">{allProblems}</p>}

              <div className="traffic-actions">
                <button
                  className="traffic-primary"
                  disabled={!!allProblems || drawing || busy}
                  onClick={() => void assess()}
                >
                  {busy
                    ? 'Calculating whole township…'
                    : assessment
                    ? 'Re-calculate whole township'
                    : `Assess impact (${validSites.length} site${validSites.length > 1 ? 's' : ''})`}
                </button>
                {busy && <button onClick={cancel}>Cancel</button>}
              </div>

              {!validSites.length && <p>Finish drawing at least one site and assign an access road.</p>}
              {stale && <p className="traffic-notice">Sites were modified. Re-calculate to see updated impacts.</p>}
              {expired && <p className="traffic-notice">Traffic snapshot expired. Refresh for current observations.</p>}
              {error && (
                <p className="traffic-notice" role="alert">
                  {error}
                </p>
              )}
            </section>

            {result && (
              <section>
                <h2>Whole-Township Results</h2>
                <div className="traffic-switch" aria-label="Traffic comparison">
                  <button aria-pressed={view === 'current'} onClick={() => setView('current')}>
                    Current traffic
                  </button>
                  <button aria-pressed={view === 'proposed'} onClick={() => setView('proposed')}>
                    With township ({sites.length} sites)
                  </button>
                </div>

                <div className="traffic-metrics">
                  <div>
                    <strong>{rounded(result.tripsPerHour)}</strong>
                    <span>total new trips/hour</span>
                  </div>
                  <div>
                    <strong>{result.affectedRoads}</strong>
                    <span>township roads carrying added flow</span>
                  </div>
                </div>

                <div className="traffic-verdict">
                  {result.newlyCongested > 0
                    ? `${result.newlyCongested} monitored road segment(s) cross into the congestion threshold under new load.`
                    : result.coveredRoads === 0
                    ? 'No evaluated routes currently have live TomTom coverage. Impacts on these corridors are based on modeled network delay.'
                    : `No newly detected congestion among covered corridors (${result.coveredRoads} observed links monitored, ${(result.routeCoverage * 100).toFixed(0)}% route coverage).`}
                </div>

                {result.alreadyCongested > 0 && (
                  <p className="traffic-notice mt-2">
                    Note: {result.alreadyCongested} monitored link(s) already experience baseline congestion before development.
                  </p>
                )}

                {result.unassignedPerHour > 0 && (
                  <p className="traffic-notice mt-2">
                    {rounded(result.unassignedPerHour)} trips/h could not be routed due to road closures or disconnected paths.
                  </p>
                )}

                <h2 className="mt-4">Top corridors absorbing new traffic</h2>
                <div className="traffic-impact-roads">
                  {affected.map(r => (
                    <button
                      className="traffic-impact-road"
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                    >
                      <span>
                        <strong>{r.name || 'Unnamed Street'}</strong>
                        <small>
                          +{rounded(r.extraVehicles)} vehicles/hour · {r.observed ? 'live TomTom' : 'township network link'}
                        </small>
                      </span>
                      <b>
                        {r.currentSeconds !== null && r.proposedSeconds !== null
                          ? `+${Math.round(r.proposedSeconds - r.currentSeconds)} s`
                          : `+${rounded(r.extraVehicles)} veh/h`}
                      </b>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {link && (
              <section>
                <h2>{link.name || 'Selected road'}</h2>
                <p>
                  {link.from} → {link.to} · {Math.round(link.length)} m
                </p>
                {observation ? (
                  <>
                    <div className="traffic-fields">
                      <div>
                        <small>Current speed</small>
                        <h2>{observation.currentSpeed} km/h</h2>
                      </div>
                      <div>
                        <small>With township</small>
                        <h2>{road?.proposedSpeed != null ? `${road.proposedSpeed.toFixed(0)} km/h` : '—'}</h2>
                      </div>
                    </div>
                    <p>
                      Confidence: {Math.round(observation.confidence * 100)}% · Free-flow {observation.freeFlowSpeed} km/h
                    </p>
                  </>
                ) : (
                  <>
                    <div className="traffic-fields">
                      <div>
                        <small>Free-flow speed</small>
                        <h2>{Math.round((link.length / Math.max(1, link.seconds)) * 3.6)} km/h</h2>
                      </div>
                      <div>
                        <small>Added vehicles</small>
                        <h2>+{rounded(road?.extraVehicles || 0)} /h</h2>
                      </div>
                    </div>
                    <p>Township distributor link (inferred capacity: {link.capacity} veh/h).</p>
                  </>
                )}
              </section>
            )}

            <details>
              <summary>Save / load multi-site proposals</summary>
              <button disabled={!!allProblems || drawing} onClick={save}>
                Save proposal on this device
              </button>
              {saved.map(s => (
                <div className="traffic-actions" key={s.id}>
                  <button
                    onClick={() => {
                      cancel();
                      setSites(s.sites);
                      setActiveSiteId(s.sites[0]?.id || 'site-1');
                      setDrawing(false);
                      setView('current');
                      setAssessment(null);
                      setMessage(`Restored proposal with ${s.sites.length} site(s).`);
                    }}
                  >
                    {s.name} ({s.sites.length} sites)
                  </button>
                  <button
                    aria-label={`Delete ${s.name}`}
                    onClick={() => {
                      try {
                        const next = saved.filter(x => x.id !== s.id);
                        localStorage.setItem(key, JSON.stringify(next));
                        setSaved(next);
                      } catch {
                        setMessage('Could not update device storage.');
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </details>
          </>
        )}

        {message && (
          <p role="status" className="traffic-notice">
            {message}
          </p>
        )}

        <footer>
          Map © OpenStreetMap contributors · Traffic © TomTom. Multi-site distribution models trips across the whole township network.
        </footer>
      </aside>
    </div>
  );
}
