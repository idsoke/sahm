// Moves the site to another host name: every text file under web/ that names
// the current host (PUBLIC_HOST in wrangler.toml) gets the new one, so the
// canonical and Open Graph tags, the sitemap, robots.txt, the Worker's host
// check and the tests agree. Run it once the Cloudflare account (and later a
// custom domain) exists:
//   node web/scripts/set-host.mjs sahm.<your-subdomain>.workers.dev
// then rebuild the share card (node web/scripts/og.mjs) and run the tests.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".wrangler", "docs"]);
const TEXT = /\.(html|js|mjs|css|json|toml|txt|xml|md)$|^_headers$/;

export function currentHost(toml) {
  const m = toml.match(/^PUBLIC_HOST = "([^"]+)"$/m);
  if (!m) throw new Error("wrangler.toml has no PUBLIC_HOST");
  return m[1];
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith("llms")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (TEXT.test(name)) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = String(process.argv[2] || "").trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(next)) {
    console.error("usage: node web/scripts/set-host.mjs <host name, e.g. sahm.example.workers.dev>");
    process.exit(2);
  }
  const from = currentHost(readFileSync(join(web, "wrangler.toml"), "utf8"));
  if (from === next) { console.log(`already on ${next}`); process.exit(0); }
  let changed = 0;
  for (const p of files(web)) {
    const s = readFileSync(p, "utf8");
    if (!s.includes(from)) continue;
    writeFileSync(p, s.split(from).join(next));
    changed++;
    console.log(`  ${relative(web, p)}`);
  }
  console.log(`${from} -> ${next} in ${changed} files; now run node web/scripts/og.mjs and node --test web/test/*.mjs`);
}
