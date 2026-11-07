import { readFileSync, writeFileSync } from "node:fs";
const [, , src, out] = process.argv;
const rows = []; let sector = null, last = null, odd = [];
for (const raw of readFileSync(src, "utf8").trim().split("\n")) {
  const [page, rest] = raw.split("\t");
  const t = rest.split(" | ").join(" ").replace(/\s+/g, " ").trim();
  let m;
  if (/^I\. Saham yang Diterbitkan Emiten Syariah/.test(t)) { sector = "Emiten Syariah"; continue; }
  if ((m = t.match(/^([A-Z])\. (.+)$/)) && sector !== null) { sector = m[2]; continue; }
  if (/^III\. /.test(t)) { sector = null; continue; }
  if ((m = t.match(/^(\d+) ([A-Z0-9]{4}) (.+)$/)) && sector) {
    last = { no: +m[1], code: m[2], name: m[3], sector }; rows.push(last); continue;
  }
  if (sector && !/^(No\. |- \d+ -|II\. Saham$|Dokumen|Elektronik|Validation|OJK -)/.test(t)) odd.push(`${page}: ${t}`);
}
const nums = rows.map(r => r.no);
console.log("rows", rows.length, "consecutive", nums.every((n, i) => n === i + 1),
  "unique codes", new Set(rows.map(r => r.code)).size);
console.log("unparsed lines inside list:", odd);
const sectors = {}; rows.forEach(r => sectors[r.sector] = (sectors[r.sector] || 0) + 1); console.log(sectors);
const q = s => /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
writeFileSync(out, "code,name,sector\n" + rows.map(r => [r.code, r.name, r.sector].map(q).join(",")).join("\n") + "\n");
