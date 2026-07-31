/**
 * Where the payloads come from.
 *
 * They used to be `import`ed from JSON files next to this one, which meant the
 * numbers were frozen into the export at build time. They are now fetched from
 * the Flask blueprint, which builds them from the Unity Catalog tables — so a
 * data load reaches the dashboard without a rebuild.
 *
 * The base URL is injected by next.config.mjs and tracks `basePath`, so a
 * standalone (root-served) build points at /api and the portal build at
 * /galileo/api. Override with NEXT_PUBLIC_GALILEO_API_BASE for local work,
 * where `next dev` serves :3000 while Flask serves the API on :8000 —
 * `output: "export"` rules out a rewrite proxy.
 */
const BASE = process.env.NEXT_PUBLIC_GALILEO_API_BASE ?? "/galileo/api";

export function apiUrl(name: string): string {
  return `${BASE}/${name}.json`;
}

export async function fetchPayload<T>(name: string): Promise<T> {
  const res = await fetch(apiUrl(name), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Galileo API: ${name} responded ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch once per page load, however many components ask.
 *
 * Payloads are immutable for the lifetime of a page — the server rebuilds them
 * on its own schedule — so the in-flight promise is the cache. Keyed by name so
 * the heavy ones (site_analysis, db) are not refetched when a second component
 * mounts.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function loadPayload<T>(name: string): Promise<T> {
  let promise = inFlight.get(name) as Promise<T> | undefined;
  if (!promise) {
    promise = fetchPayload<T>(name);
    // A failed fetch must not be cached as a permanent error: drop it so a
    // remount can retry (the API returns 503 while the warehouse is unreachable).
    promise.catch(() => inFlight.delete(name));
    inFlight.set(name, promise);
  }
  return promise;
}
