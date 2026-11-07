# web/ (Sahm)

**Sahm**, the Indonesian sharia stocks web app: a Cloudflare Worker behind
**https://sahm.sahm-web.workers.dev** (set by `scripts/set-host.mjs`;
see "First deploy" below). Sahm is built on idx's web terminal
(github.com/fzn0x/idx, MIT): the home page counts only the stocks in OJK's
Daftar Efek Syariah (`/api/market?syariah=1`), and the terminal adds
`syariah` and `screen syariah=ya`.

- `public/` the market page (`index.html`) and the browser terminal (`terminal.html`)
  in Bahasa Indonesia, their English copies under `public/en/`, and the 404 page in
  both; plain HTML/CSS/ES modules, no bundler. `public/i18n.js` reads the page's
  `<html lang>` and gives the scripts their words and number style (5.050,43 or
  5,050.43); `public/styles.css` holds the Halaman Bursa tokens for the light and
  dark themes. The two home pages share one structure: change both together, and
  `test/tools.test.mjs` and `test/seo.test.mjs` check their command tables,
  language links and search tags.
- Docs: `scripts/docs.mjs` builds `/docs/` (README.md), `/docs/<page>` (one
  per `docs/*.md`), the same pages as Markdown at `/docs/<page>.md` with
  absolute links, `/llms.txt` (llmstxt.org index) and `/llms-full.txt` (every
  page in one file) into `public/docs/`, `public/llms.txt` and
  `public/llms-full.txt`. Those are generated and gitignored: wrangler's
  `[build]` step runs the script before every `wrangler dev` and
  `wrangler deploy`, and `node web/scripts/docs.mjs` (or `npm run docs` here)
  writes them for a local look. `scripts/md.mjs` is the small Markdown
  renderer behind it (no dependencies). The pages load only `public/docs.css`
  (the site's Halaman Bursa tokens, no script). The Worker serves `/docs*` and
  `/llms*.txt` (`run_worker_first`) to give the `.md` and `.txt` files
  `charset=utf-8` and `access-control-allow-origin: *`. A new `docs/*.md`
  file goes into `PAGES` in `scripts/docs.mjs` and `public/sitemap.xml`;
  `test/docs.test.mjs` fails until it does, and checks every page's tags,
  links and anchors, the llms.txt shape and that the exit codes agree with
  docs/json-output.md.
- `src/worker.js` entry: host check, security headers, `/api/*`, cron.
  `src/headers.js` holds the security headers (CSP, nosniff, frame and
  referrer policy); `public/_headers` gives the same set to the static assets,
  which the assets layer serves without running the Worker.
  `test/headers.test.mjs` keeps the two equal and checks that every page
  works under the CSP (no inline scripts or handlers, styles only from this
  site and Google Fonts).
- `src/api.js` endpoints returning the CLI's JSON envelopes; D1-backed cache.
- `src/ipot.js` the IPOT broker summary and corporate actions (port of
  `src/providers/ipot`, names from `src/brokers.json`, generated from
  `data/brokers.csv`).
- `src/syariah.js` OJK's Daftar Efek Syariah (DES): `src/syariah.json` is
  built from `data/syariah.csv` and `data/syariah.meta.json` by
  `node web/scripts/syariah.mjs` (`test/syariah.test.mjs` keeps them equal).
  The CSV comes from the decree's Lampiran I PDF through
  `scripts/des/extract.mjs` (pdfjs-dist) and `scripts/des/parse.mjs`; redo
  both after each new DES (effective 1 June and 1 December). Quotes and
  screen rows carry `syariah` (true, false, or null for an index or foreign
  code), the screener takes `syariah=ya|tidak` and the `syariah` preset, and
  `/api/syariah` lists the DES (`sector`, `search`) or checks `symbols`.
- `src/holidays.js` the trading holidays (port of `src/holidays.rs`;
  `src/holidays.json` is `data/holidays.csv`, kept equal by a test).
  The idx.co.id commands (market-wide foreign flow, market brokers, calendar,
  indices, stock list, members) stay CLI and MCP only: idx.co.id refuses
  requests from Cloudflare Workers. The web `foreign` reads a stock's foreign
  flow from IPOT instead (`src/ipot.js`).
- `src/bandar.js` the bandarmology rules (port of `src/analysis/bandar.rs`,
  the same reasons text pinned in both test suites); `src/bandar-scan.js` the
  nightly scan behind `bandar screen`: from 16:45 WIB on a session day the
  minute cron reads the session's 100 most traded stocks (by value, from the
  quote board), four per minute, each over 1d, 1w, 1m and 3m plus its daily
  candles, into the `bandar_scan` table (`migrations/0003_bandar.sql`, the
  newest two sessions kept). A holiday is noticed by a probe and skipped; a
  stock whose fetch failed is tried once more at the end of the pass.
  `/api/bandar/status` shows the progress; a maintainer can force a step with
  `/api/refresh?token=…&what=bandar`. `/api/bandar` itself is live like
  `/api/broker`: up to 5 tickers, `daily` for one ticker and at most 23
  sessions.
- `public/chart.js` the price chart under a single-symbol `quote`: ranges 1D
  to 5Y from `/api/history`, closes over volume, a dashed previous close on
  1D, a crosshair readout (pointer, touch or arrow keys). Its layout
  functions are tested in `test/chart.test.mjs` on the recorded Yahoo charts.
- `src/yahoo.js` the Yahoo endpoints and parsers; `src/analysis.js` ports of
  the Rust indicators, verdict, growth/valuation/risk lenses, screener DSL and
  sentiment lexicon; `src/extras.js` ports of returns (with beta against a
  benchmark), dividends, news ordering and the ownership changes summary;
  `src/msn-insights.js` (ticker lookup, insights, peers) and `src/msn-screen.js`
  (the whole-market return windows, one POST) port `src/providers/msn` and are
  tested on the same `tests/fixtures/msn`. `/api/fundamental?lens=growth|valuation|risk`
  returns a lens, as MCP `idx_fundamental` does with `lens`.
- Endpoints under `/api`: `market`, `quote`, `history`, `intraday`, `profile`,
  `fundamental`, `earnings`, `financials`, `dividends`, `returns`, `technical`,
  `brief`, `compare`, `screen` (`preset`, `returns`), `news`, `sentiment`,
  `insights`, `broker`, `bandar`,
  `bandar/screen`, `bandar/status`, `bandar/broker`, `actions`, `holidays`,
  `instruments`, `members`, `ownership/ticker`,
  `ownership/entity`, `ownership/changes`, `ownership/foreign`,
  `ownership/releases`, `ownership/search`, `ownership/cross-holders`,
  `ownership/concentration`, `ownership/graph`, `universe`.
- `public/tools.js` the MCP tools with their CLI and web commands: the
  terminal's `tools` command and help buttons and the landing page's Daftar
  Perintah table use it; `test/tools.test.mjs` checks it against docs/mcp.md.
  `bandar/broker` reads the nightly scan; `instruments` and `members` serve the
  bundled lists.
- `migrations/` D1 schema. `test/` runs with `node --test web/test/*.mjs`.
- Search and sharing: canonical, Open Graph and Twitter tags on every page,
  JSON-LD on the landing page, `public/robots.txt` and `public/sitemap.xml`;
  API responses carry `x-robots-tag: noindex`. The share card
  `public/og.png` (1200x630) and `public/apple-touch-icon.png` are rendered
  from `og/card.html` and `og/icon.html` by `node web/scripts/og.mjs`
  (headless Chrome, Node 22+); re-run it after editing either source.
  `test/seo.test.mjs` checks the tags against the files.
- The cron (`* * * * *`) refreshes the whole quote board as one JSON row and
  the IHSG tape every minute in IDX hours, every 15 minutes otherwise (IDX
  holidays count as closed), which keeps writes far inside D1's free tier. A
  board older than that cadence allows (10 minutes open, 35 closed) is served
  as `stale` with a warning giving its time.
- Secrets: `ADMIN_TOKEN` (`wrangler secret put`) lets a maintainer force a
  refresh with `/api/refresh?token=…`.
- Ownership on the web: `src/ownership-sync.js` loads the KSEI register from
  the repository's `ownership-data` release (published by
  `.github/workflows/ownership.yml`) on the minute cron: index checked every
  30 minutes, one SHA-256-verified part per minute, newest month first, within
  `OWN_DAILY_WRITE_BUDGET`. No upload endpoint exists. Progress:
  `/api/ownership/status`; a maintainer can force a step with
  `/api/refresh?token=…&what=ownership`. Each holding is one holder's
  register lines summed by idx (`accounts`, plus `controller_or_affiliate`
  from the 30 Oct 2026 register; `migrations/0004_ownership_accounts.sql`).
  `ownership/search`, `cross-holders`, `concentration` and `graph` run
  `src/ownership.js` (the port of `src/ownership/analytics.rs`) over one
  month of `own_holdings`, one D1 read of the release each; search covers
  that month's spellings only, and there are no local `resolve` rules.
  A month reloads when its IDX file changes or, for an index written by idx
  0.8.2 or later, when its parts change (`parts_key`): after the mirror is
  rebuilt every kept month reloads once, newest first. Loading a month is
  about 21,600 writes and deleting the copy D1 holds costs the same, so a
  reload is about 43,000 and the budget (counted per UTC day, as D1 counts
  it) charges both. A reload starts only when it fits in what is left of the
  day, so its month is hidden for minutes, not until the next reset; with the
  default 60,000 that is one reload a day, six days for six months, each
  month readable (as its older copy) until then.

The Worker returns 404 for any Host other than `PUBLIC_HOST`. For local runs,
`web/.dev.vars` (gitignored) holds `PUBLIC_HOST=localhost`, plus an
`ADMIN_TOKEN=…` if you want `/api/refresh?token=…` to fill the board at once.

First deploy, on your own Cloudflare account:

```sh
cd web
npm install
npx wrangler login
npx wrangler d1 create sahm                         # paste the database_id into wrangler.toml
npx wrangler d1 migrations apply sahm --remote
npx wrangler deploy                                 # prints https://sahm.<subdomain>.workers.dev
node scripts/set-host.mjs sahm.<subdomain>.workers.dev   # every file to the real host
node scripts/og.mjs                                 # re-render the share card with it
node --test test/*.mjs && npx wrangler deploy
```

Local run: `npx wrangler d1 migrations apply sahm --local`, then
`npx wrangler dev`; the board fills on the cron
(`curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"`,
every minute in IDX hours, on the quarter hour otherwise).

After a deploy, the docs answer like this:

```sh
curl -sI https://sahm.sahm-web.workers.dev/llms.txt      # 200, text/plain; charset=utf-8
curl -sI https://sahm.sahm-web.workers.dev/docs/mcp.md   # 200, text/markdown; charset=utf-8, access-control-allow-origin: *
curl -sI https://sahm.sahm-web.workers.dev/docs/mcp      # 200, text/html with the CSP
curl -sI https://sahm.sahm-web.workers.dev/docs          # 307 to /docs/
curl -sI https://sahm.sahm-web.workers.dev/              # 200 with the CSP (public/_headers)
```
