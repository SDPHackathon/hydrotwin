import { useCallback, useSyncExternalStore } from "react";

// A per-phone convenience value (which guard this phone is, which finished card was dismissed) kept in
// localStorage, falling back to memory when storage is blocked. Never required for the page to work.
// The server snapshot is null, so pages render their default first and pick the stored value up after.

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // storage unavailable
  }
  return memory.get(key) ?? null;
}

export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage unavailable
      }
      listeners.forEach((cb) => cb());
    },
    [key],
  );
  return [value, set];
}
