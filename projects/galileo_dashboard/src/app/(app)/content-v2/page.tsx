"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy alias. The trend-augmented Content experience now lives at /content;
 * this route only forwards there so old bookmarks / shared "?...=" deep links
 * keep working. Client redirect (static export has no server-side redirects),
 * preserving the query string (area / market / metric / explore).
 */
function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params.toString();
  useEffect(() => {
    router.replace(qs ? `/content?${qs}` : "/content");
  }, [router, qs]);
  return null;
}

export default function ContentV2Redirect() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
