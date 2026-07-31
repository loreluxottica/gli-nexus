"use client";

import { Suspense } from "react";
import { getContent } from "@/data/content";
import { DatabaseView } from "@/components/database/DatabaseView";

/**
 * Passes only the small database_page config (columns, filters, mapping,
 * geo_col, page_size). The heavy source records are fetched separately inside
 * DatabaseView so they never load on any other route.
 */
export default function DatabasePage() {
  return (
    <Suspense fallback={null}>
      <DatabaseView config={getContent().database_page} />
    </Suspense>
  );
}
