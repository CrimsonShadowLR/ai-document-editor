/**
 * localStorage helpers that never throw: private windows and blocked site data
 * make the accessor fail, and the app must still work (just without saving).
 */
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Returns false when the value couldn't be saved (storage full or unavailable). */
export function writeStorage<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Keep working in memory; the caller decides whether to tell the user.
    return false;
  }
}
