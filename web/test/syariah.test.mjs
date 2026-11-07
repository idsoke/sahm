// node --test web/test/*.mjs (no network). OJK's Daftar Efek Syariah: the
// bundled JSON matches data/syariah.csv, quotes and screen rows carry
// `syariah`, the screener filters on it, and /api/syariah lists and checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as y from "../src/yahoo.js";
import * as an from "../src/analysis.js";
import * as des from "../src/syariah.js";
import { quote, screen, syariah, route, market } from "../src/api.js";
import { buildDes, csvFields } from "../scripts/syariah.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const rows = (p) => JSON.parse(read("tests", "fixtures", p)).quoteResponse.result.map(y.parseV7Quote);

function boardDb(board) {
  const kv = new Map([["board", { v: JSON.stringify(board), updated_at: board.ts }]]);
  return { prepare: (sql) => ({ bind: (...a) => ({
    first: async () => (sql.includes("FROM kv") ? kv.get(a[0]) ?? null : null),
    all: async () => ({ results: [] }), run: async () => ({}),
  }) }) };
}
const now = new Date("2026-11-06T10:00:00Z");
const BOARD = { ts: Math.floor(now.getTime() / 1000) - 60, quotes: rows("yahoo/quote_v7_bbca_bbri_tlkm.json"), index: null, warnings: [] };
const env = { DB: boardDb(BOARD) };

test("src/syariah.json is data/syariah.csv with its decree (run node web/scripts/syariah.mjs)", () => {
  const built = buildDes(read("data", "syariah.csv"), JSON.parse(read("data", "syariah.meta.json")));
  assert.deepEqual(JSON.parse(read("web", "src", "syariah.json")), built);
});

test("the DES as OJK published it: 622 codes, no duplicates, decree KEP-21/D.04/2026", () => {
  assert.equal(des.META.count, 622);
  assert.equal(des.META.decree, "KEP-21/D.04/2026");
  assert.equal(des.META.effective, "2026-06-01");
  const all = des.list();
  assert.equal(all.length, 622);
  assert.equal(new Set(all.map((e) => e.code)).size, 622);
  for (const e of all) assert.match(e.code, /^[A-Z0-9]{4}$/, e.code);
  assert.equal(des.SECTORS[0], "Emiten Syariah");
  assert.deepEqual(des.list("emiten syariah").map((e) => e.code), ["BANK", "BBMI", "BRIS", "BTPS", "JMAS", "PNBS", "SPOT"]);
  assert.equal(des.list("energi").length, 63);
  assert.deepEqual(des.list(null, "telkom").map((e) => e.code), ["TLKM"]);
});

test("isSyariah: true or false for a stock code, null where the DES does not speak", () => {
  assert.equal(des.isSyariah("TLKM"), true);
  assert.equal(des.isSyariah("tlkm.jk"), true);
  assert.equal(des.isSyariah("BBCA"), false);
  for (const s of ["^JKSE", "D05.SI", "BUKA-W", "", null]) assert.equal(des.isSyariah(s), null, String(s));
  assert.deepEqual(des.entry("BRIS"), { code: "BRIS", name: "PT Bank Syariah Indonesia (Persero) Tbk", sector: "Emiten Syariah" });
  assert.equal(des.entry("BBCA"), null);
});

test("csvFields reads quoted fields", () => {
  assert.deepEqual(csvFields('ABCD,"PT A, B ""C"" Tbk",Energi'), ["ABCD", 'PT A, B "C" Tbk', "Energi"]);
});

test("the screener's syariah key takes ya/tidak with = and !=", () => {
  assert.equal(an.parseFilters("syariah=ya")[0].bool, true);
  assert.equal(an.parseFilters("syariah=tidak")[0].bool, false);
  assert.equal(an.parseFilters("syariah!=ya")[0].bool, false);
  assert.equal(an.parseFilters("sharia=true")[0].field, "syariah");
  assert.throws(() => an.parseFilters("syariah>1"), (e) => e.code === "usage" && /only supports = and !=/.test(e.message));
  assert.throws(() => an.parseFilters("syariah=mungkin"), (e) => e.code === "usage" && /syariah=ya/.test(e.message));
  assert.equal(an.sortField("syariah"), null, "not a sort key");
  const f = an.parseFilters("syariah=ya");
  assert.ok(an.matches({ syariah: true }, f));
  assert.ok(!an.matches({ syariah: false }, f));
  assert.ok(!an.matches({ syariah: null }, f), "unknown never matches");
});

test("quotes carry syariah before behind_session", async () => {
  const got = await quote(env, "BBCA,TLKM", now);
  assert.deepEqual(got.data.map((q) => [q.symbol, q.syariah]), [["BBCA", false], ["TLKM", true]]);
  const keys = Object.keys(got.data[0]);
  assert.deepEqual(keys.slice(-2), ["syariah", "behind_session"]);
});

test("screen syariah=ya keeps the DES stocks and names the decree; the preset does the same", async () => {
  const s = await screen(env, "syariah=ya", null, 25, 20, null, null, false, now);
  assert.deepEqual(s.data.rows.map((r) => r.symbol), ["TLKM"]);
  assert.deepEqual(s.data.syariah_list, { decree: "KEP-21/D.04/2026", period: "2026-I", effective: "2026-06-01" });
  const non = await screen(env, "syariah=tidak", null, 25, 20, null, null, false, now);
  assert.deepEqual(non.data.rows.map((r) => r.symbol).sort(), ["BBCA", "BBRI"]);
  const all = await screen(env, "", null, 25, 20, null, null, false, now);
  assert.equal(all.data.syariah_list, null);
  assert.ok(all.data.rows.every((r) => typeof r.syariah === "boolean"));
  const p = await screen(env, "", null, 25, 20, null, "syariah", false, now);
  assert.deepEqual(p.data.rows.map((r) => r.symbol), ["TLKM"]);
});

test("/api/syariah lists the DES by sector and search, and checks symbols", async () => {
  const sec = syariah(null, "kesehatan");
  assert.equal(sec.schema, "idx.syariah.v1");
  assert.equal(sec.provider, "ojk");
  assert.equal(sec.data.total, 33);
  assert.equal(sec.data.decree, "KEP-21/D.04/2026");
  assert.equal(syariah(null, "zzz").data.total, 0);
  assert.match(syariah(null, "zzz").warnings[0], /no DES sector matches "zzz"/);
  const chk = await route({}, new URL("https://x/api/syariah?symbols=BRIS,BBCA,^JKSE"));
  assert.equal(chk.schema, "idx.syariah.check.v1");
  assert.deepEqual(chk.data.checks.map((c) => [c.symbol, c.syariah, c.sector]), [["BRIS", true, "Emiten Syariah"], ["BBCA", false, null], ["^JKSE", null, null]]);
});

test("market?syariah=1 counts only DES stocks; the plain market is unchanged", async () => {
  const m = await market(env, now, { syariah: true });
  assert.equal(m.data.universe, 1);
  assert.equal(m.data.quoted, 1);
  assert.deepEqual(m.data.heavyweights.map((q) => q.symbol), ["TLKM"]);
  assert.deepEqual(m.data.syariah_list, { decree: "KEP-21/D.04/2026", period: "2026-I", effective: "2026-06-01", count: 622 });
  const all = await market(env, now);
  assert.equal(all.data.quoted, 3);
  assert.equal(all.data.syariah_list, null);
  const routed = await route(env, new URL("https://x/api/market?syariah=1"));
  assert.deepEqual(routed.data.heavyweights.map((q) => q.symbol), ["TLKM"]);
});

test("public/license.txt is the repository's LICENSE, copyright line included", () => {
  const licence = read("LICENSE");
  assert.equal(read("web", "public", "license.txt"), licence, "copy LICENSE to web/public/license.txt after changing it");
  assert.match(licence, /^Copyright \(c\) 2026 Midori Research and idx contributors$/m);
  for (const page of [["index.html"], ["en", "index.html"], ["404.html"], ["en", "404.html"]]) {
    assert.match(read("web", "public", ...page), /href="\/license\.txt"/, page.join("/"));
  }
});
