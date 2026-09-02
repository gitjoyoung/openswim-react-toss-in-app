// 저장된 증거만으로 재분석한다. 자유수영 근거 블록을 넓게 잡고, DB 세션이 공식 문서에 존재하는지 확인한다.
// 네트워크 요청 없음.
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

const BEFORE = 5;
const AFTER = 25;
const pad = (n) => String(n).padStart(2, "0");

function ranges(t) {
  const s = new Set();
  for (const m of t.matchAll(/(\d{1,2})\s*[:시]\s*(\d{2})?\s*[~\-–—]\s*(\d{1,2})\s*[:시]\s*(\d{2})?/g)) {
    if (+m[1] > 23 || +m[3] > 23) continue;
    s.add(`${pad(+m[1])}:${m[2] ?? "00"}-${pad(+m[3])}:${m[4] ?? "00"}`);
  }
  return s;
}

const NO_WEEKDAY = /평일\s*자유\s*수영\s*(불가|없음|미운영)/;
const LESSON_ONLY = /자유\s*수영\s*\(?\s*수강생\s*\)?/;

const ids = JSON.parse(fs.readFileSync(process.env.TARGETS ?? "tmp/needs-check-ids.json", "utf8"));
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(
  "select id,name,sido,homepage_url,free_swim from public.pools where id = any($1) order by name",
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

  const numbered = fs.readFileSync(file, "utf8").split("\n");
  const plain = numbered.map((l) => l.replace(/^\s*\d+\|\s?/, ""));

  const blocks = [];
  for (let i = 0; i < plain.length; i++) {
    if (!/자유\s*수영/.test(plain[i])) continue;
    blocks.push({ line: i + 1, text: plain.slice(Math.max(0, i - BEFORE), i + AFTER).join("\n") });
  }
  const officialRanges = new Set();
  for (const b of blocks) for (const r of ranges(b.text)) officialRanges.add(r);

  const dbByDay = (p.free_swim ?? []).map((d) => ({
    day: d.day,
    sessions: (d.sessions ?? []).map((s) => `${s.start}-${s.end}`),
  }));
  const db = [...new Set(dbByDay.flatMap((d) => d.sessions))];
  const matched = db.filter((s) => officialRanges.has(s));
  const missing = db.filter((s) => !officialRanges.has(s));

  const blockText = blocks.map((b) => b.text).join("\n");
  const noWeekday = NO_WEEKDAY.test(blockText);
  const lessonOnly = LESSON_ONLY.test(blockText);
  const dbHasWeekday = dbByDay.some((d) => d.day >= 1 && d.day <= 5 && d.sessions.length);

  let verdict;
  if (!blocks.length) verdict = "근거 없음";
  else if (!db.length) verdict = "DB 비어있음";
  else if (noWeekday && dbHasWeekday) verdict = "충돌: 공식은 평일 자유수영 불가";
  else if (!officialRanges.size) verdict = "자유수영 언급만 있고 시간 없음";
  else if (!missing.length) verdict = "DB 전부 공식 문서에서 확인";
  else if (matched.length) verdict = "일부만 공식 문서에서 확인";
  else verdict = "공식 문서에서 DB 시간 확인 불가";

  out.push({
    id: p.id,
    name: p.name,
    sido: p.sido,
    homepage: p.homepage_url,
    verdict,
    dbByDay,
    matched,
    missing,
    officialRanges: [...officialRanges].slice(0, 30),
    flags: { noWeekdayFreeSwim: noWeekday, lessonOnly },
    evidenceFile: file,
    evidenceLines: blocks.slice(0, 5).map((b) => b.line),
  });
}

fs.writeFileSync("tmp/reanalysis.json", JSON.stringify(out, null, 2));
const counter = {};
for (const r of out) counter[r.verdict] = (counter[r.verdict] ?? 0) + 1;
console.log("재분석:", out.length);
console.log(JSON.stringify(counter, null, 2));
