import { Suspense } from "react";
import { Masthead } from "@/components/shell/Masthead";
import { PageTabs } from "@/components/shell/PageTabs";
import { StoryGate } from "@/components/story/StoryGate";
import { GalileoData } from "@/data/GalileoData";

/** Observatory shell: masthead + page tabs around every app route. The
 *  landing page at "/" lives outside this group and renders chrome-free.
 *
 *  Everything here reads the fetched payloads (the masthead shows the reporting
 *  period, the routes show the figures), so the whole shell sits behind the data
 *  gate rather than each route fetching for itself. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <GalileoData>
        {/* useSearchParams (AreaTabs, PageTabs) needs a Suspense ancestor under static export. */}
        <Suspense fallback={null}>
          <Masthead />
          <PageTabs />
          <StoryGate />
        </Suspense>
        <main id="main" tabIndex={-1} className="content">
          {children}
        </main>
      </GalileoData>
    </>
  );
}
