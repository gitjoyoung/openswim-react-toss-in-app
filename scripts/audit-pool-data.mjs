// 저장된 증거 텍스트만으로 재분석한다. 네트워크 재요청 없음.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);

const pad = (n) => String(n).padStart(2, "0");
const WINDOW = 500;

function ranges(t) {
  const s = new Set();
  for (const m of t.matchAll(/(\d{1,2})\s*[:시]\s*(\d{2})?\s*[~\-–—]\s*(\d{1,2})\s*[:시]\s*(\d{2})?/g)) {
    if (+m[1] > 23 || +m[3] > 23) continue;
    s.add(`${pad(+m[1])}:${m[2] ?? "00"}-${pad(+m[3])}:${m[4] ?? "00"}`);
  }
  return s;
}
// "자유수영 10시,11시,13시" 같은 시각 나열
function hourList(t) {
  const s = new Set();
  for (const m of t.matchAll(/(\d{1,2})\s*시(?!\s*[~\-–—간])/g)) {
    const h = +m[1];
    if (h >= 5 && h <= 23) s.add(pad(h));
  }
  return s;
}
function prices(t) {
  const s = new Set();
  for (const m of t.matchAll(/([0-9][0-9,]{2,8})\s*원/g)) {
    const n = Number(m[1].replaceAll(",", ""));
    if (n >= 300 && n <= 200000) s.add(n);
  }
  return s;
}
function windows(text, re) {
  const out = [];
  for (const m of text.matchAll(re)) out.push({ idx: m.index, text: text.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW) });
  return out;
}
function lineOf(numbered, needleIdx) {
  const upto = numbered.slice(0, needleIdx);
  return upto.split("\n").length;
}

const ids = JSON.parse(fs.readFileSync("tmp/target-ids.json", "utf8"));
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(
  "select id,name,sido,homepage_url,price_free_swim,free_swim from public.pools where id = any($1) order by name",
  [ids],
);
await c.end();

const out = [];
for (const p of rows) {
  const dir = path.join("evidence/pools", p.id);
  if (!fs.existsSync(dir)) continue;
  const day = fs.readdirSync(dir).sort().pop();
  const file = path.join(dir, day, "page-text.txt");
  if (!fs.existsSync(file)) continue;
  const numbered = fs.readFileSync(file, "utf8");
  const text = numbered.replace(/^\s*\d+\|\s?/gm, "");

  const ctxs = windows(text, /자유\s*수영/g);
  const ctxText = ctxs.map((x) => x.text).join("\n");
  const ctxRanges = ranges(ctxText);
  const ctxHours = hourList(ctxText);
  const ctxPrices = prices(ctxText);

  const db = [...new Set((p.free_swim ?? []).flatMap((d) => (d.sessions ?? []).map((s) => `${s.start}-${s.end}`)))];
  const dbStartHours = [...new Set((p.free_swim ?? []).flatMap((d) => (d.sessions ?? []).map((s) => s.start.slice(0, 2))))];

  const matchRange = db.filter((x) => ctxRanges.has(x));
  const matchHour = dbStartHours.filter((h) => ctxHours.has(h));
  const missingHour = [...ctxHours].filter((h) => !dbStartHours.includes(h));

  // 근거 문장 (자유수영이 실제 시간과 함께 등장하는 첫 문장)
  const evidenceSnippet =
    ctxs.map((x) => x.text).find((t) => /\d{1,2}\s*[:시]/.test(t))?.replace(/\s+/g, " ").slice(0, 220) ?? null;
  const evidenceLine = ctxs.length ? lineOf(numbered, ctxs[0].idx) : null;

  let verdict;
  if (!db.length) verdict = "db-empty";
  else if (!ctxs.length) verdict = "공식페이지에 자유수영 언급 없음";
  else if (!ctxRanges.size && !ctxHours.size) verdict = "자유수영 언급만 있고 시간 표기 없음";
  else if (matchRange.length === db.length) verdict = "일치";
  else if (matchRange.length || matchHour.length) verdict = "부분 일치";
  else verdict = "충돌";

  out.push({
    id: p.id,
    name: p.name,
    sido: p.sido,
    homepage: p.homepage_url,
    verdict,
    dbSessions: db,
    dbStartHours,
    officialRanges: [...ctxRanges].slice(0, 30),
    officialHours: [...ctxHours].sort(),
    matchedRanges: matchRange,
    matchedHours: matchHour,
    officialHoursMissingInDb: missingHour,
    dbPrice: p.price_free_swim,
    officialPricesNearFreeSwim: [...ctxPrices].slice(0, 12),
    priceMatch: p.price_free_swim == null ? null : ctxPrices.has(p.price_free_swim),
    evidenceFile: file,
    evidenceLine,
    evidenceSnippet,
  });
}

fs.writeFileSync("tmp/evidence-analysis.json", JSON.stringify(out, null, 2));
const counter = {};
for (const r of out) counter[r.verdict] = (counter[r.verdict] ?? 0) + 1;
console.log("분석:", out.length);
console.log(JSON.stringify(counter, null, 2));
