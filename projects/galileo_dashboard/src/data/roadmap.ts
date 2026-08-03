/* ===========================================================================
   Development roadmap — DETACHABLE MODULE (presentation only).

   This file is the single source of truth for the roadmap content: edit the
   plan here, never in the components. Dates are ISO and read as UTC.

   To remove the whole feature: delete this file, src/components/roadmap/,
   src/app/roadmap/, and the <RoadmapLink /> line in src/app/page.tsx.
   Nothing else in the app imports any of it.
   ======================================================================== */

/** done = shipped · active = running now · planned = ahead of us */
export type RoadmapStatus = "done" | "active" | "planned";

/** Category symbols that can replace a bullet's default dot. */
export type BulletIconKind = "glasses" | "lens" | "bolt";

/** A point of substance. The delivered/added distinction is NOT stored here —
 *  it is which list the point sits in (see `delivers` / `adds`). What is left
 *  is pure decoration:
 *    icon     — a category symbol instead of the default dot
 *    emphasis — accent pill treatment, for the one hook worth noticing */
export type RoadmapBullet =
  | string
  | {
      text: string;
      icon?: BulletIconKind;
      emphasis?: boolean;
    };

export type RoadmapMilestone = {
  id: string;
  /** ISO date the milestone lands on. Drives its position on the bar and the
   *  month stamp under the flag — the chart is the ONLY place time is stated,
   *  so the detail panel never has to be kept in step with it. */
  date: string;
  label: string;
  status: RoadmapStatus;
};

export type RoadmapItem = {
  id: string;
  /** id of the lane this bar belongs to */
  lane: string;
  /** Printed inside the bar, so it must SAY what the phase is — no "Phase 1".
   *  It is clipped, not wrapped: the narrowest bar holds roughly 21 chars. */
  label: string;
  /** The phase said in full. Titles the detail panel, so the bars can stay
   *  terse without the plan reading as "Phase 1, Phase 2, Engine change". */
  headline: string;
  start: string;
  end: string;
  /** true = the work trails past its end date (bar gets a chevron tail) */
  open?: boolean;
  status: RoadmapStatus;
  /** The payoff, in one sentence — the "so what" behind the bullets. Shown
   *  beside them, because a Gantt can show timing but never worth. */
  impact: string;
  /** What the phase changes or improves in what already exists. */
  delivers?: RoadmapBullet[];
  /** What the phase brings that was not there before. Kept apart from
   *  `delivers` because "new capability" and "better version of a thing we
   *  have" are the two questions the room actually asks. */
  adds?: RoadmapBullet[];
  milestones?: RoadmapMilestone[];
};

export type RoadmapLane = {
  id: string;
  title: string;
  subtitle?: string;
};

export type Roadmap = {
  title: string;
  /** visible time window of the chart */
  axis: { start: string; end: string };
  lanes: RoadmapLane[];
  /** ARRAY ORDER = the order the "Present" mode reveals them. It is the
   *  narrative order of the pitch, not necessarily the chronological one. */
  items: RoadmapItem[];
};

export const roadmap: Roadmap = {
  title: "Development roadmap",
  axis: { start: "2026-03-01", end: "2027-06-30" },

  lanes: [
    { id: "tool", title: "Tool", subtitle: "Usability & efficiency" },
    { id: "accounting", title: "Accounting views", subtitle: "Perimeter validation" },
    { id: "expansion", title: "Expansion", subtitle: "Accessibility & scalability" },
  ],

  items: [
    {
      id: "phase-1",
      lane: "tool",
      label: "Simpler tool",
      headline: "A simpler tool on a leaner process",
      start: "2026-03-15",
      end: "2026-06-30",
      open: true,
      status: "done",
      impact: "Reporting effort goes into analysis instead of assembly.",
      delivers: [
        "A single surface replaces the manual reporting chain",
        "Fewer handoffs between the data pull and the published view",
        "Recurring preparation drops out of the monthly cycle",
      ],
    },
    {
      id: "phase-2",
      lane: "accounting",
      label: "Regional validation",
      headline: "Perimeter validation across regions",
      start: "2026-05-12",
      end: "2026-12-31",
      status: "active",
      impact: "One set of figures the business and accounting both sign off on.",
      delivers: [
        "Each region's perimeter reconciled against accounting",
        "One agreed set of figures once all three regions close",
      ],
      milestones: [
        { id: "emea", date: "2026-05-31", label: "EMEA", status: "done" },
        { id: "na", date: "2026-10-31", label: "NA", status: "planned" },
        { id: "apac-latam", date: "2026-12-31", label: "APAC & LATAM", status: "planned" },
      ],
    },
    {
      id: "engine-change",
      lane: "tool",
      label: "Engine change",
      headline: "New engine under the same surface",
      start: "2026-09-01",
      end: "2026-12-31",
      status: "planned",
      impact: "The tool can keep growing without another rebuild.",
      delivers: ["Rebuilt foundations, so the tool stays maintainable and accessible"],
      adds: [{ text: "Cortana implementation", emphasis: true, icon: "bolt" }],
    },
    {
      id: "phase-3",
      lane: "expansion",
      label: "Expanded scope",
      headline: "Beyond frames, into new product families",
      start: "2026-11-15",
      end: "2027-06-15",
      status: "planned",
      impact: "Visibility covers the full product range, not just frames.",
      adds: [
        { text: "Wearables", icon: "glasses", emphasis: true },
        { text: "Contact lenses", icon: "lens", emphasis: true },
      ],
    },
  ],
};

export const STATUS_LABEL: Record<RoadmapStatus, string> = {
  done: "Delivered",
  active: "In progress",
  planned: "Planned",
};
