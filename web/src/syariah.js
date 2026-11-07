// OJK's Daftar Efek Syariah (DES): the stocks OJK lists as sharia-compliant,
// bundled from the decree's Lampiran I (data/syariah.csv, built into
// syariah.json by scripts/syariah.mjs). The DES is the authority; nothing here
// is estimated. OJK replaces it every May and November (effective 1 June and
// 1 December) and amends it between them, so META says which decree this is.
import DES from "./syariah.json" with { type: "json" };

export const META = Object.freeze({
  source: DES.source, period: DES.period, decree: DES.decree, signed: DES.signed,
  effective: DES.effective, replaces: DES.replaces, url: DES.url, count: DES.count,
});

const BY_CODE = new Map(DES.stocks.map(([code, name, sector]) => [code, { code, name, sector }]));

/** The sector headings of the decree, in its order ("Emiten Syariah" first). */
export const SECTORS = [...new Set(DES.stocks.map(([, , sector]) => sector))];

/** An IDX stock code: four letters or digits, nothing else (not ^JKSE, D05.SI or a warrant like BUKA-W). */
const STOCK_CODE = /^[A-Z0-9]{4}$/;

/**
 * Whether a symbol is in the DES: true or false for an IDX stock code, null for
 * anything the DES does not speak to (an index, another market, a warrant).
 */
export function isSyariah(symbol) {
  const s = String(symbol || "").trim().toUpperCase().replace(/\.JK$/, "");
  if (!STOCK_CODE.test(s)) return null;
  return BY_CODE.has(s);
}

/** The DES entry of a code ({ code, name, sector }), or null. */
export function entry(symbol) {
  return BY_CODE.get(String(symbol || "").trim().toUpperCase().replace(/\.JK$/, "")) || null;
}

/** The DES, narrowed by sector (a part of its heading, any case) and by a part of the code or name. */
export function list(sector = null, search = null) {
  const sec = String(sector || "").trim().toLowerCase();
  const q = String(search || "").trim().toLowerCase();
  return [...BY_CODE.values()].filter((e) =>
    (!sec || e.sector.toLowerCase().includes(sec)) &&
    (!q || e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)));
}
