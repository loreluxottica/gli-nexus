"use client";

import { Suspense } from "react";
import { getContent } from "@/data/content";
import { DatabaseView } from "@/components/database/DatabaseView";

/**
 * Passes the small column/filter config and reporting metadata for scoped
 * links. DatabaseView reuses the memoized records loaded by a prior CSV action.
 */
export default function DatabasePage() {
  return (
    <Suspense fallback={null}>
      <DatabaseView config={getContent().database_page} view={getContent().current_view} />
    </Suspense>
  );
}
