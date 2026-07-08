import { Suspense } from "react";
import { content } from "@/data/content";
import { DatabaseView } from "@/components/database/DatabaseView";

/**
 * Server passes only the small database_page config (columns, filters, mapping,
 * geo_col, page_size). The heavy 944 KB records are lazy-imported client-side
 * inside DatabaseView so they never touch the shared bundle or other routes.
 */
export default function DatabasePage() {
  return (
    <Suspense fallback={null}>
      <DatabaseView config={content.database_page} />
    </Suspense>
  );
}
