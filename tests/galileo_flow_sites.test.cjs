const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { flowSites, flowTotals, visibleFlowSites, flowSitesHref, contentScopeHref, isSiteSort } =
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
