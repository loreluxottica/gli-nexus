const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { flowSites, flowTotals, visibleFlowSites, flowSitesHref, contentScopeHref, isSiteSort,
  contentFlowKey, scopedSourceRecords, databaseCsv, resolveFlowScope, flowRecordsScope,
  flowRecordsHref, flowSitesReturnHref } =
  require(path.join(process.env.GALILEO_TEST_OUT, "lib", "flowSites.js"));

const flow = "Frames|Finished Frames";
const scope = { flow, area: "EMEA", market: "LM", period: 4 };
function data(records = {}) {
  return {
    flow_site_metrics: {
      "4": { [flow]: { EMEA: records, ALL: { Global: [1, 1, 1, 1, 999, 999, 9, 9] } } },
      "1": { [flow]: { EMEA: { January: [0, 0, 0, 0, 10, 8, 2, 2] } } },
    },
  };
}

test("market offsets, period, flow and canonical area stay independent", () => {
  const fixture = data({ Site: [10, 8, 2, 1, 900, 600, 90, 60] });
  const lm = flowSites(fixture, scope).rows[0];
  const rep = flowSites(fixture, { ...scope, market: "REP" }).rows[0];
  assert.equal(lm.pieces.cur, 900);
  assert.equal(lm.pieces.yoy, 0.5);
  assert.equal(rep.pieces.cur, 10);
  assert.equal(rep.efficiency.cur, 5);
  assert.equal(flowSites(fixture, { ...scope, period: 1 }).rows[0].site, "January");
  assert.deepEqual(flowSites(fixture, { ...scope, area: "APAC" }).rows, []);
  assert.deepEqual(flowSites(fixture, { ...scope, flow: "Frames|GV Frames*" }).rows, []);
});

test("all contributors survive; prior-only and shipment-only activity is included", () => {
  const fixture = data(Object.fromEntries(Array.from({ length: 35 }, (_, i) =>
    [`Site ${i}`, [0, 0, 0, 0, i, 1, 2, 2]])));
  fixture.flow_site_metrics["4"][flow].EMEA.PriorOnly = [0, 0, 0, 0, 0, 20, 0, 5];
  fixture.flow_site_metrics["4"][flow].EMEA.ShipmentsOnly = [0, 0, 0, 0, 0, 0, 7, 8];
  fixture.flow_site_metrics["4"][flow].EMEA.REPOnly = [5, 5, 1, 1, 0, 0, 0, 0];
  const result = flowSites(fixture, scope);
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 37);
  assert.ok(result.rows.some((row) => row.site === "PriorOnly"));
  assert.ok(result.rows.some((row) => row.site === "ShipmentsOnly"));
  assert.ok(!result.rows.some((row) => row.site === "REPOnly"));
});

test("zero ratios are distinct from ratios with no shipments", () => {
  const { rows } = flowSites(data({
    Zero: [0, 0, 0, 0, 0, 100, 10, 10],
    Missing: [0, 0, 0, 0, 10, 0, 0, 0],
  }), scope);
  assert.deepEqual(rows[0].efficiency, { cur: 0, py: 10, yoy: -1, delta: -10 });
  assert.deepEqual(rows[1].efficiency, { cur: null, py: null, yoy: null, delta: null });
  assert.equal(rows[1].pieces.yoy, null);
  assert.equal(rows[1].pieces.delta, 10);
});

test("missing period and malformed tuples report errors, not empty success", () => {
  assert.match(flowSites(data(), { ...scope, period: 3 }).error, /unavailable/);
  assert.match(flowSites({}, scope).error, /unavailable/);
  for (const bad of [[1, 2], [0, 0, 0, 0, NaN, 1, 2, 3], [0, 0, 0, 0, null, 1, 2, 3]]) {
    const result = flowSites(data({ Broken: bad }), scope);
    assert.match(result.error, /invalid figures/);
    assert.deepEqual(result.rows, []);
  }
});

test("search spans the complete list, is case insensitive and never mutates data", () => {
  const fixture = data({
    Biggest: [0, 0, 0, 0, 1000, 1000, 20, 20],
    "Fourth & Co": [0, 0, 0, 0, 1, 1, 1, 1],
  });
  const before = JSON.stringify(fixture);
  const rows = flowSites(fixture, scope).rows;
  const originalNames = rows.map((row) => row.site);
  assert.equal(visibleFlowSites(rows, " fourth & ", "pieces")[0].site, "Fourth & Co");
  visibleFlowSites(rows, "", "name");
  assert.deepEqual(rows.map((row) => row.site), originalNames);
  assert.equal(JSON.stringify(fixture), before);
});

test("absolute-change ranking differs from size and percentage ranking", () => {
  const rows = flowSites(data({
    Largest: [0, 0, 0, 0, 1000, 1000, 20, 20],
    Falling: [0, 0, 0, 0, 20, 800, 4, 10],
    Rising: [0, 0, 0, 0, 100, 1, 50, 1],
  }), scope).rows;
  assert.equal(visibleFlowSites(rows, "", "pieces")[0].site, "Largest");
  assert.equal(visibleFlowSites(rows, "", "pieces-change")[0].site, "Falling");
  assert.equal(visibleFlowSites(rows, "", "shipments")[0].site, "Rising");
  assert.equal(visibleFlowSites(rows, "", "shipments-change")[0].site, "Rising");
});

test("ties use site name for deterministic ordering", () => {
  const rows = flowSites(data({
    Zebra: [0, 0, 0, 0, 10, 5, 1, 1],
    Alpha: [0, 0, 0, 0, 10, 5, 1, 1],
  }), scope).rows;
  assert.deepEqual(visibleFlowSites(rows, "", "pieces").map((row) => row.site), ["Alpha", "Zebra"]);
});

test("totals consume the authoritative cell and never average site ratios", () => {
  const cell = {
    pieces: { rep: 999, rep_py: 999, rep_yoy: 0, lm: 100, lm_py: 200, lm_yoy: -0.5 },
    shipments: { rep: 3, rep_py: 3, rep_yoy: 0, lm: 10, lm_py: 10, lm_yoy: 0 },
  };
  const totals = flowTotals(cell, "LM");
  assert.equal(totals.pieces.cur, 100);
  assert.equal(totals.efficiency.cur, 10);
  assert.equal(totals.efficiency.py, 20);
  assert.equal(flowTotals(null, "LM"), null);
});

test("links encode the exact flow and site, keep scope and do not leak explorer state", () => {
  const url = new URL(flowSitesHref({ ...scope, site: "A&B / Porto + #1", sort: "shipments-change" }), "http://localhost");
  assert.equal(url.pathname, "/content/sites");
  assert.equal(url.searchParams.get("site"), "A&B / Porto + #1");
  assert.equal(url.searchParams.get("flow"), flow);
  assert.equal(url.searchParams.get("market"), "LM");
  assert.equal(url.searchParams.get("area"), "EMEA");
  assert.equal(url.searchParams.get("period"), "4");
  assert.equal(url.searchParams.get("sort"), "shipments-change");
  assert.equal(url.searchParams.has("explore"), false);
  const back = new URL(contentScopeHref(scope), "http://localhost");
  assert.equal(back.pathname, "/content");
  assert.equal(back.searchParams.get("period"), "4");
  assert.equal(back.searchParams.has("site"), false);
  assert.equal(isSiteSort("shipments-change"), true);
  assert.equal(isSiteSort("arbitrary"), false);
});

function source(month, site, market, product, siteType, pieces, shipments, geo = "EMEA") {
  return [month, site, market, product, siteType, pieces, shipments, geo, "", "IT", geo];
}

const currentRow = {
  category: "Frames", sub_category: "Finished Frames",
  geo_data: { EMEA: { pieces: { lm: 100 }, shipments: { lm: 10 } } }, acct_data: {},
};
const oldRow = { geo_data: { EMEA: { pieces: { lm: 40 }, shipments: { lm: 4 } } }, acct_data: {} };
const currentView = {
  year: "2026", period_number: "4", period_label: "YTD April",
  period_options: [{ n: 2, label: "YTD February" }, { n: 4, label: "YTD April" }],
  rows: [currentRow], periods: { "2": { rows: [oldRow] } },
};
const recordsParams = () => new URL(flowRecordsHref(
  "selected=Demo+Lyon&selected=Demo+Porto", scope, 2026,
), "http://localhost").searchParams;

test("shared scope resolution preserves current and earlier cells without an area fallback", () => {
  const params = recordsParams();
  assert.equal(resolveFlowScope(params, currentView).cell, currentRow.geo_data.EMEA);
  params.set("period", "2");
  const earlier = resolveFlowScope(params, currentView);
  assert.deepEqual(earlier.scope, { ...scope, period: 2 });
  assert.equal(earlier.cell, oldRow.geo_data.EMEA);
  params.set("area", "APAC");
  assert.equal(resolveFlowScope(params, currentView).cell, null);
  params.delete("area");
  params.delete("market");
  assert.equal(resolveFlowScope(params, currentView).scope.area, "ALL");
  assert.equal(resolveFlowScope(params, currentView).scope.market, "REP");
});

test("records links preserve site working state without reusing Database refinements", () => {
  const original = new URLSearchParams({
    q: "Porto & Lyon", sort: "shipments-change", page: "2", site: "A&B / Porto + #1",
    compare: "1", "db-q": "old search", "db-page": "9", "db-market": "REP",
  });
  original.append("selected", "Demo Lyon");
  original.append("selected", "A&B / Porto + #1");
  const url = new URL(flowRecordsHref(original.toString(), scope, 2026), "http://localhost");
  assert.equal(url.pathname, "/database");
  assert.equal(url.searchParams.get("year"), "2026");
  assert.equal(url.searchParams.get("period"), "4");
  assert.equal(url.searchParams.get("records"), "sites");
  assert.equal(url.searchParams.get("market"), "LM");
  assert.equal(url.searchParams.get("db-q"), null);
  const resolved = flowRecordsScope(url.searchParams, currentView);
  assert.deepEqual(resolved.scope, scope);
  assert.deepEqual(resolved.sites, ["Demo Lyon", "A&B / Porto + #1"]);
  url.searchParams.set("db-q", "France");
  url.searchParams.set("db-page", "4");
  url.searchParams.set("db-product", "Finished Frames");
  const back = new URL(flowSitesReturnHref(url.searchParams.toString()), "http://localhost");
  assert.equal(back.pathname, "/content/sites");
  for (const key of ["q", "sort", "page", "site", "compare"]) {
    assert.equal(back.searchParams.get(key), original.get(key));
  }
  assert.deepEqual(back.searchParams.getAll("selected"), original.getAll("selected"));
  assert.equal(back.searchParams.has("records"), false);
  assert.ok([...back.searchParams.keys()].every((key) => !key.startsWith("db-")));
  assert.equal(original.get("db-q"), "old search");
});

test("incomplete, invalid, stale-year and accounting record links report errors", () => {
  const invalid = [
    ["records", "unknown"], ["flow", "unknown"], ["area", "unknown"], ["market", "unknown"],
    ["period", "3"], ["period", "0"], ["period", "2.5"], ["period", "NaN"],
    ["year", "2025"], ["year", "invalid"], ["acct", "1"], ["selected", ""],
  ];
  for (const [key, value] of invalid) {
    const params = recordsParams();
    params.set(key, value);
    assert.ok(flowRecordsScope(params, currentView).error, `${key}=${value}`);
  }
  for (const key of ["flow", "period", "year", "selected"]) {
    const params = recordsParams();
    params.delete(key);
    assert.ok(flowRecordsScope(params, currentView).error, `missing ${key}`);
  }
  const earlier = recordsParams();
  earlier.set("period", "2");
  assert.match(flowRecordsScope(earlier, { ...currentView, periods: {} }).error, /totals are unavailable/);
  assert.match(resolveFlowScope(new URLSearchParams("flow=Frames%7CFinished+Frames&year=2025"), currentView).error, /year/);
});

test("ordinary Database links are not implicitly scoped and repeated sites are deduplicated", () => {
  const params = recordsParams();
  params.delete("records");
  assert.equal(flowRecordsScope(params, currentView), null);
  params.set("records", "sites");
  params.append("selected", "Demo Lyon");
  assert.deepEqual(flowRecordsScope(params, currentView).sites, ["Demo Lyon", "Demo Porto"]);
  params.delete("area");
  params.delete("market");
  const defaults = flowRecordsScope(params, currentView);
  assert.equal(defaults.scope.area, "ALL");
  assert.equal(defaults.scope.market, "REP");
});

test("Database drill-through and CSV consume identical monthly rows despite site search and paging", () => {
  const rows = [
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 20, 2),
    source("2025-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 12, 1),
    source("2026-04", "Demo Porto", "LM", "Finished Frames", "Lab", 8, 1),
    source("2026-05", "Demo Lyon", "LM", "Finished Frames", "Lab", 3, 1),
    source("2026-02", "Demo Lyon", "REP", "Finished Frames", "Lab", 9, 1),
    source("2026-02", "Demo Lyon", "LM", "GV Frames", "Lab", 8, 1),
    source("2026-02", "Another", "LM", "Finished Frames", "Lab", 5, 1),
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 3, 1, "NA"),
  ];
  rows[0][7] = "NA"; // Displayed geography must not replace canonical attribution.
  const before = JSON.stringify(rows);
  const params = recordsParams();
  params.set("q", "Does not match");
  params.set("page", "2");
  params.set("sort", "shipments-change");
  const investigation = flowRecordsScope(params, currentView);
  const browsed = scopedSourceRecords(rows, investigation.scope, investigation.sites, investigation.year);
  const exported = scopedSourceRecords(rows, scope, ["Demo Lyon", "Demo Porto"], 2026);
  assert.deepEqual(browsed, exported);
  assert.equal(browsed.length, 3);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(browsed[0], rows[0]);
});

test("source export keeps database grain and the active scope only", () => {
  const rows = [
    source("2026-05", "Demo Lyon", "LM", "Finished Frames", "Lab", 10, 1),
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 20, 2),
    source("2025-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 5, 1),
    source("2026-02", "Demo Porto", "LM", "Finished Frames", "Lab", 7, 1),
    source("2026-02", "Demo Lyon", "REP", "Finished Frames", "Lab", 9, 1),
    source("2026-02", "Demo Lyon", "LM", "GV Frames", "Lab", 8, 1),
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 0, 0),
    source("2026-02", "Demo Lyon", "LM", "RX", "Local Labs to ECP", 4, 1),
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 3, 1, "NA"),
    source("2026-02", "Hidden", "LM", "Finished Frames", "Lab", 11, 1),
    source("2026-02", "", "LM", "Finished Frames", "Lab", 2, 1),
    source("2026-02", "Demo Lyon", "LM", "Finished Frames", "Lab", 1, 0, ""),
  ];
  const matched = scopedSourceRecords(rows, scope, ["Demo Lyon", "Demo Porto", "(unknown)"], 2026);
  assert.deepEqual(matched.map((row) => [row[0], row[1], row[5]]), [
    ["2026-02", "Demo Lyon", 20],
    ["2025-02", "Demo Lyon", 5],
    ["2026-02", "Demo Porto", 7],
    ["2026-02", "", 2],
  ]);
  assert.deepEqual(scopedSourceRecords(rows, { ...scope, area: "ALL" }, ["Demo Lyon"], 2026).map((row) => row[10]), ["EMEA", "EMEA", "NA"]);
  assert.equal(contentFlowKey("RX", "Export Labs"), "RX Lenses|Export Labs");
  assert.equal(contentFlowKey("Stock Lenses", "Other"), null);
  const columns = [
    { label: "Month" }, { label: "Site, name" }, { label: "Market" }, { label: "Product" },
    { label: "Site type" }, { label: "Pieces" }, { label: "Shipments" }, { label: "Geo" },
    { label: "Accounting" }, { label: 'Country "X"' },
  ];
  const record = source("2026-02", 'Lyon, "A"', "LM", "Finished Frames", "Lab", 20, 2);
  record[10] = "canonical-hidden";
  const csv = databaseCsv(columns, [record]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.slice(1).split("\n")[0], 'Month,"Site, name",Market,Product,Site type,Pieces,Shipments,Geo,Accounting,"Country ""X"""');
  assert.match(csv, /"Lyon, ""A"""/);
  assert.equal(csv.includes("canonical-hidden"), false);
  assert.equal(scopedSourceRecords(rows, scope, [], 2026).length, 0);
});
