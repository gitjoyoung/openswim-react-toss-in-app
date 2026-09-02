// v2: '자유수영' 문맥 안의 시간만 비교하고, 근거 텍스트를 증거 폴더에 저장한다.
import fs from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);

const OUT = process.env.OUT ?? "tmp/context-verify.jsonl";
const TARGETS = process.env.TARGETS ?? "tmp/target-ids.json";
const LIMIT = Number(process.env.LIMIT ?? 40);
const CONCURRENCY = 2;
const TIMEOUT = 12000;
const MAX_LINKS = 8;
const WINDOW = 400;
const TODAY = new Date().toISOString().slice(0, 10);

process.on("unhandledRejection", (e) => console.error("unhandled:", e?.message ?? e));

const linkWord = /(자유수영|자유\s*수영|이용안내|이용\s*안내|운영안내|시간표|요금|이용료|수영장|프로그램|강습|시설안내)/;
const clean = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ");

async function get(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: c.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; OpenswimAudit/2.0)", accept: "text/html,*/*" },
    });
  } finally {
    clearTimeout(t);
  }
}

function links(html, base) {
  const out = [];
  const seen = new Set();
  let origin;
  try {
    origin = new URL(base).origin;
  } catch {
    return out;
  }
  for (const tag of html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let u;
    try {
      u = new URL(href.replaceAll("&amp;", "&"), base);
    } catch {
      continue;
    }
    if (u.origin !== origin || seen.has(u.href)) continue;
    const text = clean(tag).trim();
    if (!linkWord.test(text)) continue;
    seen.add(u.href);
    out.push({
      url: u.href,
      text: text.slice(0, 60),
      score: /자유\s*수영/.test(text) ? 40 : /시간표/.test(text) ? 25 : /요금|이용료/.test(text) ? 20 : 10,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_LINKS);
}

const pad = (n) => String(n).padStart(2, "0");
function ranges(text) {
  const set = new Set();
  for (const m of text.matchAll(/(\d{1,2})\s*[:시]\s*(\d{2})?\s*[~\-–—]\s*(\d{1,2})\s*[:시]\s*(\d{2})?/g)) {
    if (+m[1] > 23 || +m[3] > 23) continue;
    set.add(`${pad(+m[1])}:${m[2] ?? "00"}-${pad(+m[3])}:${m[4] ?? "00"}`);
  }
  return set;
}
function prices(text) {
  const set = new Set();
  for (const m of text.matchAll(/([0-9][0-9,]{2,8})\s*원/g)) {
    const n = Number(m[1].replaceAll(",", ""));
    if (n >= 300 && n <= 200000) set.add(n);
  }
  return set;
}

function contexts(text, word = /자유\s*수영/g) {
  const out = [];
  for (const m of text.matchAll(word)) {
    out.push(text.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW));
  }
  return out;
}

const ids = JSON.parse(fs.readFileSync(TARGETS, "utf8"));
const rows = await (async () => {
  const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    "select id,name,sido,homepage_url,price_free_swim,free_swim from public.pools where id = any($1) order by name",
    [ids],
  );
  await c.end();
  return r.rows;
})();

let done = new Set();
try {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) if (line.trim()) done.add(JSON.parse(line).id);
} catch {}
const queue = rows.filter((r) => !done.has(r.id)).slice(0, LIMIT);
console.log(`대상 ${rows.length} | 완료 ${done.size} | 이번 ${queue.length}`);

const stream = createWriteStream(OUT, { flags: "a" });
let cursor = 0;
let n = 0;

async function inspect(pool) {
  const base = { id: pool.id, name: pool.name, sido: pool.sido, homepage: pool.homepage_url, collectedAt: TODAY };
  try {
    const home = await get(pool.homepage_url);
    if (!home.ok) return { ...base, status: `http-${home.status}` };
    const homeHtml = (await home.text()).slice(0, 2000000);
    const pages = [{ url: home.url, html: homeHtml }];
    for (const l of links(homeHtml, home.url)) {
      try {
        const r = await get(l.url);
        if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) continue;
        pages.push({ url: r.url, html: (await r.text()).slice(0, 2000000) });
      } catch {}
    }
    const text = pages.map((p) => `\n===== ${p.url} =====\n` + clean(p.html)).join("\n");

    const dir = path.join("evidence/pools", pool.id, TODAY);
    fs.mkdirSync(dir, { recursive: true });
    const numbered = text.split("\n").map((l, i) => `${String(i + 1).padStart(5, " ")}| ${l}`).join("\n");
    fs.writeFileSync(path.join(dir, "page-text.txt"), numbered);
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({ poolId: pool.id, name: pool.name, pages: pages.map((p) => p.url), collectedAt: TODAY }, null, 2),
    );

    const ctxs = contexts(text);
    const ctxRanges = new Set();
    const ctxPrices = new Set();
    for (const cx of ctxs) {
      for (const r of ranges(cx)) ctxRanges.add(r);
      for (const p of prices(cx)) ctxPrices.add(p);
    }
    const allRanges = ranges(text);

    const dbSessions = [...new Set((pool.free_swim ?? []).flatMap((d) => (d.sessions ?? []).map((s) => `${s.start}-${s.end}`)))];
    const inCtx = dbSessions.filter((s) => ctxRanges.has(s));
    const inPage = dbSessions.filter((s) => allRanges.has(s));

    let verdict;
    if (!dbSessions.length) verdict = "db-empty";
    else if (!ctxs.length) verdict = "page-no-freeswim-mention";
    else if (!ctxRanges.size) verdict = "freeswim-mentioned-no-times";
    else if (inCtx.length === dbSessions.length) verdict = "verified";
    else if (inCtx.length) verdict = "partial";
    else verdict = "conflict";

    return {
      ...base,
      status: "ok",
      pages: pages.map((p) => p.url),
      evidenceDir: dir,
      dbSessions,
      freeSwimContextRanges: [...ctxRanges].slice(0, 40),
      matchedInContext: inCtx,
      matchedAnywhere: inPage,
      dbPrice: pool.price_free_swim,
      contextPrices: [...ctxPrices].slice(0, 20),
      priceInContext: pool.price_free_swim == null ? null : ctxPrices.has(pool.price_free_swim),
      verdict,
    };
  } catch (e) {
    return { ...base, status: e.name === "AbortError" ? "timeout" : "fetch-error", error: e.message };
  }
}

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= queue.length) return;
    stream.write(JSON.stringify(await inspect(queue[i])) + "\n");
    n++;
    if (n % 10 === 0) console.log(`${n}/${queue.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await new Promise((r) => stream.end(r));
console.log(`완료 ${n}건 → ${OUT}`);
