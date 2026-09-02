// needs_check 시설을 대상으로 공식 사이트를 2단계까지 따라가며 자유수영 시간표 근거를 찾는다.
// 근거 문장과 줄 번호를 함께 남기고, 판정은 사람이 확인할 수 있게 예외 큐로 출력한다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

const OUT = process.env.OUT ?? "tmp/recheck.jsonl";
const TARGETS = process.env.TARGETS ?? "tmp/needs-check-ids.json";
const LIMIT = Number(process.env.LIMIT ?? 30);
const CONCURRENCY = 2;
const TIMEOUT = 12000;
const TODAY = new Date().toISOString().slice(0, 10);

process.on("unhandledRejection", (e) => console.error("unhandled:", e?.message ?? e));

const clean = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|p|div|li|h\d)>/gi, "\n")
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
      headers: { "user-agent": "Mozilla/5.0 (compatible; OpenswimAudit/3.0)", accept: "text/html,*/*" },
    });
  } finally {
    clearTimeout(t);
  }
}

function scoreLink(text, href) {
  const hay = `${text} ${href}`;
  let s = 0;
  if (/자유\s*수영/.test(hay)) s += 60;
  if (/시간표|운영시간|이용시간/.test(hay)) s += 30;
  if (/이용안내|이용요금|요금안내/.test(hay)) s += 20;
  if (/수영장|수영/.test(hay)) s += 12;
  if (/프로그램|강습/.test(hay)) s += 6;
  if (/공지|게시판|notice/i.test(hay)) s += 4;
  return s;
}

function linksOf(html, base, limit) {
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
    if (/\.(jpg|jpeg|png|gif|zip|hwp|xls|xlsx|docx?)$/i.test(u.pathname)) continue;
    const text = clean(tag).trim().slice(0, 60);
    const s = scoreLink(text, u.href);
    if (s < 12) continue;
    seen.add(u.href);
    out.push({ url: u.href, text, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

const pad = (n) => String(n).padStart(2, "0");
function timeRanges(t) {
  const out = [];
  for (const m of t.matchAll(/(\d{1,2})\s*[:시]\s*(\d{2})?\s*[~\-–—～∼〜－]\s*(\d{1,2})\s*[:시]\s*(\d{2})?/g)) {
    if (+m[1] > 23 || +m[3] > 23) continue;
    out.push({ range: `${pad(+m[1])}:${m[2] ?? "00"}-${pad(+m[3])}:${m[4] ?? "00"}`, idx: m.index });
  }
  return out;
}

// '자유수영'이 등장하는 줄과 그 주변에서 시간을 뽑는다. 줄 번호를 근거로 남긴다.
function freeSwimEvidence(numberedLines) {
  const hits = [];
  for (let i = 0; i < numberedLines.length; i++) {
    if (!/자유\s*수영/.test(numberedLines[i])) continue;
    const block = numberedLines.slice(Math.max(0, i - 3), i + 8).join("\n");
    const ranges = [...new Set(timeRanges(block).map((r) => r.range))];
    const days = [...new Set((block.match(/(월|화|수|목|금|토|일)요일|평일|주말|공휴일/g) ?? []))];
    if (ranges.length) {
      hits.push({
        line: i + 1,
        quote: numberedLines[i].replace(/\s+/g, " ").trim().slice(0, 180),
        blockRanges: ranges.slice(0, 12),
        days,
      });
    }
  }
  return hits;
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
  for (const l of fs.readFileSync(OUT, "utf8").split("\n")) if (l.trim()) done.add(JSON.parse(l).id);
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
    const homeHtml = (await home.text()).slice(0, 2500000);
    const pages = [{ url: home.url, html: homeHtml }];
    const visited = new Set([home.url]);

    // 1단계
    const l1 = linksOf(homeHtml, home.url, 8);
    for (const l of l1) {
      if (visited.has(l.url)) continue;
      try {
        const r = await get(l.url);
        if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) continue;
        const html = (await r.text()).slice(0, 2500000);
        visited.add(r.url);
        pages.push({ url: r.url, html });
        // 2단계: 자유수영 관련 링크만 추가로 따라간다
        for (const l2 of linksOf(html, r.url, 3)) {
          if (visited.has(l2.url) || l2.score < 30) continue;
          try {
            const r2 = await get(l2.url);
            if (!r2.ok || !(r2.headers.get("content-type") ?? "").includes("html")) continue;
            visited.add(r2.url);
            pages.push({ url: r2.url, html: (await r2.text()).slice(0, 2500000) });
          } catch {}
        }
      } catch {}
    }

    const text = pages.map((p) => `\n===== ${p.url} =====\n` + clean(p.html)).join("\n");
    const lines = text.split("\n");
    const numbered = lines.map((l, i) => `${String(i + 1).padStart(5, " ")}| ${l}`).join("\n");

    const dir = path.join("evidence/pools", pool.id, TODAY);
    fs.mkdirSync(path.join(dir, "html"), { recursive: true });
    fs.writeFileSync(path.join(dir, "page-text.txt"), numbered);
    const pageRecords = pages.map((p, i) => {
      const file = `html/${String(i).padStart(2, "0")}.html`;
      fs.writeFileSync(path.join(dir, file), p.html);
      return { url: p.url, file, bytes: Buffer.byteLength(p.html), sha256: crypto.createHash("sha256").update(p.html).digest("hex") };
    });
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({ poolId: pool.id, name: pool.name, homepage: pool.homepage_url, collectedAt: TODAY, collectedAtIso: new Date().toISOString(), fetchMode: "http-fetch-no-js-depth2", pages: pageRecords }, null, 2),
    );

    const evidence = freeSwimEvidence(lines);
    const db = [...new Set((pool.free_swim ?? []).flatMap((d) => (d.sessions ?? []).map((s) => `${s.start}-${s.end}`)))];
    const official = [...new Set(evidence.flatMap((e) => e.blockRanges))];
    const matched = db.filter((x) => official.includes(x));

    let verdict;
    if (!evidence.length) verdict = "근거 없음";
    else if (!db.length) verdict = "DB 비어있음, 공식 근거 발견";
    else if (matched.length === db.length) verdict = "일치";
    else if (matched.length) verdict = "부분 일치";
    else verdict = "불일치";

    return {
      ...base,
      status: "ok",
      pageCount: pages.length,
      evidenceDir: dir,
      dbSessions: db,
      officialRanges: official.slice(0, 20),
      matched,
      evidence: evidence.slice(0, 6),
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
