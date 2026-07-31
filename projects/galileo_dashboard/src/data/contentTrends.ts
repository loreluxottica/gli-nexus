import type { ContentTrends } from "./types";
import { loadPayload } from "./api";

/**
 * Monthly trend series powering the Content V2 sparklines (~15 KB), derived
 * from the shipment records. Small enough to load with the core payload, unlike
 * the records themselves which stay on the /database route.
 *
 * Loaded once by <GalileoData>; read synchronously below that gate.
 */
let cached: ContentTrends | null = null;

export async function loadContentTrends(): Promise<ContentTrends> {
  if (!cached) cached = await loadPayload<ContentTrends>("content_trends");
  return cached;
}

export function getContentTrends(): ContentTrends {
  if (!cached) {
    throw new Error(
      "Galileo: content_trends payload not loaded — this component rendered outside <GalileoData>",
    );
  }
  return cached;
}
