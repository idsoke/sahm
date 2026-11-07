// Builds src/syariah.json from data/syariah.csv (OJK's Daftar Efek Syariah,
// parsed from the decree's Lampiran I by scripts/des/) and
// data/syariah.meta.json (the decree it came from). Run after a new DES:
//   node web/scripts/syariah.mjs
// test/syariah.test.mjs fails while the two disagree.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** One CSV line into fields; quoted fields may hold commas and doubled quotes. */
export function csvFields(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function buildDes(csv, meta) {
  const [head, ...lines] = csv.trim().split(/\r?\n/);
  if (head !== "code,name,sector") throw new Error(`unexpected header "${head}"`);
  const stocks = lines.map((l) => csvFields(l));
  if (stocks.length !== meta.count) throw new Error(`${stocks.length} rows, the decree lists ${meta.count}`);
  return { ...meta, stocks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const des = buildDes(readFileSync(join(root, "data", "syariah.csv"), "utf8"), JSON.parse(readFileSync(join(root, "data", "syariah.meta.json"), "utf8")));
  writeFileSync(join(root, "web", "src", "syariah.json"), JSON.stringify(des) + "\n");
  console.log(`web/src/syariah.json: ${des.stocks.length} stocks, ${des.decree}, effective ${des.effective}`);
}
