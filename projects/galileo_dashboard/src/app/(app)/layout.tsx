import { Suspense } from "react";
import { Masthead } from "@/components/shell/Masthead";
import { PageTabs } from "@/components/shell/PageTabs";
import { StoryGate } from "@/components/story/StoryGate";

/** Observatory shell: masthead + page tabs around every app route. The
 *  landing page at "/" lives outside this group and renders chrome-free. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* useSearchParams (AreaTabs, PageTabs) needs a Suspense ancestor under static export. */}
      <Suspense fallback={null}>
        <Masthead />
        <PageTabs />
        <StoryGate />
      </Suspense>
      <main id="main" tabIndex={-1} className="content">
        {children}
      </main>
    </>
  );
}
