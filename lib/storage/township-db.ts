// Browser IndexedDB storage for downloaded custom townships.
// Persists indefinitely on the user's device for instant zero-lag loading.

import type { Area, Streets } from "@/lib/area";
import type { Drain } from "@/lib/engine/types";

export interface LocalTownship {
  slug: string;
  name: string;
  bbox: [number, number, number, number];
  center: [number, number];
  attribution: string;
  downloadedAt: string;
  data: {
    area: Area;
    streets: Streets;
    buildings: GeoJSON.FeatureCollection;
    drains: Drain[];
    floodZones: GeoJSON.FeatureCollection;
  };
}

export type LocalTownshipMeta = Pick<LocalTownship, "slug" | "name" | "bbox" | "center" | "downloadedAt">;

const DB_NAME = "hydrotwin_townships_db";
const DB_VERSION = 1;
const STORE_NAME = "townships";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "slug" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalTownship(township: LocalTownship): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(township);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalTownship(slug: string): Promise<LocalTownship | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(slug);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalTownships(): Promise<LocalTownshipMeta[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as LocalTownship[];
        const metas: LocalTownshipMeta[] = all.map(({ slug, name, bbox, center, downloadedAt }) => ({
          slug,
          name,
          bbox,
          center,
          downloadedAt,
        }));
        resolve(metas);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteLocalTownship(slug: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(slug);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
