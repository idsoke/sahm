import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const [, , src, out] = process.argv;
const doc = await getDocument({ data: new Uint8Array(readFileSync(src)) }).promise;
const lines = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const { items } = await page.getTextContent();
  const rows = new Map();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: it.transform[4], s: it.str });
  }
  for (const y of [...rows.keys()].sort((a, b) => b - a))
    lines.push(`p${i}\t` + rows.get(y).sort((a, b) => a.x - b.x).map(r => r.s.trim()).join(" | "));
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(doc.numPages, lines.length);
