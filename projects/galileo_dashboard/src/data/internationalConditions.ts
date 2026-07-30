/**
 * Business rules: when a Frames Replenishment flow counts as
 * Accounting Area = INTERNATIONAL.
 * (Workbook sheet InternationalConditions — presentation-ready, no market IDs.)
 */

export interface InternationalCase {
  /** When this case applies (sales org + ship-to), plain language. */
  when: string;
}

export interface InternationalRule {
  /** Plant code(s). Multiple codes share the same cases (sorted A→Z in UI). */
  plants: string[];
  /** One or more cases under that plant group. */
  cases: InternationalCase[];
}

/**
 * CN03’s two workbook rows are folded into one plant with two cases.
 * Market is always Replenishment (not listed per row — shared gate).
 */
export const INTERNATIONAL_RULES: InternationalRule[] = [
  {
    plants: ["CN03"],
    cases: [
      { when: "Sales org US33, ship-to Italy" },
      { when: "Sales org not NLR1 or US33, any ship-to" },
    ],
  },
  {
    plants: ["TH04"],
    cases: [{ when: "Any sales org, ship-to not Chile, Colombia or Peru" }],
  },
  {
    plants: ["US03"],
    cases: [{ when: "Any sales org, ship-to Italy" }],
  },
  {
    plants: ["BR03"],
    cases: [{ when: "Any sales org, ship-to Italy" }],
  },
  {
    // Multi-plant row: keep codes alphabetical for scanability.
    plants: ["GB05", "IT03", "JP01", "MX03", "US01"],
    cases: [{ when: "Any sales org, any ship-to" }],
  },
];
