import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const { rows } = await c.query("select id,name,sido,gu,homepage_url,phone,price_free_swim,prices,free_swim,facilities,updated_at from public.pools");
await c.end();

const mins = (t) => { const [h,m] = String(t).split(":").map(Number); return h*60+(m||0); };
const flags = [];
for (const p of rows) {
  const f = [];
  const fs_ = Array.isArray(p.free_swim) ? p.free_swim : [];
  const allSessions = fs_.flatMap(d => d.sessions ?? []);
  if (!fs_.length) f.push("자유수영 없음");
  // 1) 모든 요일이 완전히 동일 → 시설 운영시간 복사 의심
  const sig = fs_.map(d => JSON.stringify(d.sessions));
  if (fs_.length >= 5 && new Set(sig).size === 1) f.push("모든 요일 동일");
  // 2) 주말 없음
  const days = new Set(fs_.map(d => d.day));
  if (fs_.length && ![0,6].some(d => days.has(d))) f.push("주말 없음");
  // 3) 한 세션이 5시간 초과 → 시설 운영시간 의심
  if (allSessions.some(s => mins(s.end) - mins(s.start) > 300)) f.push("5시간 초과 세션");
  // 4) 하루 총 개방 10시간 초과
  for (const d of fs_) {
    const total = (d.sessions ?? []).reduce((a,s) => a + (mins(s.end)-mins(s.start)), 0);
    if (total > 600) { f.push("하루 10시간 초과"); break; }
  }
  // 5) 종료<=시작
  if (allSessions.some(s => mins(s.end) <= mins(s.start))) f.push("시간 역전");
  // 6) 요금 이상
  if (p.price_free_swim != null && (p.price_free_swim < 500 || p.price_free_swim > 50000)) f.push("요금 이상치");
  if (p.price_free_swim == null) f.push("요금 없음");
  // 7) 출처 없음
  if (!p.homepage_url) f.push("홈페이지 없음");
  if (!p.phone) f.push("전화 없음");
  if (f.length) flags.push({ id:p.id, name:p.name, sido:p.sido, homepage:p.homepage_url, flags:f, updated:p.updated_at });
}
fs.writeFileSync("tmp/data-sanity.json", JSON.stringify(flags, null, 2));
const counter = {};
for (const x of flags) for (const k of x.flags) counter[k] = (counter[k]??0)+1;
console.log("전체:", rows.length, "| 의심 항목이 있는 시설:", flags.length);
console.log(JSON.stringify(counter, null, 2));
