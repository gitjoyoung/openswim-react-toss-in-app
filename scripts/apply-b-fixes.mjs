// 오늘 B 세션이 등록한 행의 후속 수정 전용. 다른 행은 건드리지 않는다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const WRITE = process.argv.includes("--write");
const DAY = { "일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6,"공휴일":7 };
const fixes = JSON.parse(fs.readFileSync("docs/data/worksplit/B-fixes.json", "utf8"));
const registered = new Set(fs.readFileSync("docs/data/worksplit/progress-B.jsonl","utf8").trim().split("\n")
  .map(JSON.parse).filter(r => r.verdict === "register").map(r => r.new_id));

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const plans = [];
for (const f of fixes) {
  const r = (await c.query("select * from pools where name=$1", [f.name])).rows;
  if (r.length !== 1) { console.log(`건너뜀 | ${f.name} | 일치 행 ${r.length}개`); continue; }
  const row = r[0];
  if (!registered.has(row.id)) { console.log(`차단 | ${f.name} | 오늘 등록한 행이 아님(${row.id})`); continue; }
  const set = { ...f.set };
  if (set.free_swim) set.free_swim = set.free_swim.map(d => ({ day: DAY[d.day] ?? d.day,
    sessions: d.sessions.map(s => { const [a,b] = s.split("-"); return { start:a, end:b }; }) }));
  plans.push({ id: row.id, name: f.name, before: row, set, reason: f.reason });
  console.log(`\n= ${f.name}`);
  console.log(`  사유: ${f.reason}`);
  for (const [k,v] of Object.entries(set)) {
    const b = row[k];
    const fmt = (x) => k === "free_swim" ? (Array.isArray(x) ? x.filter(d=>d.sessions?.length).length + "일 " + x.reduce((s,d)=>s+(d.sessions?.length??0),0) + "회차" : String(x)) : String(x ?? "없음").slice(0, 90);
    console.log(`  ${k}: ${fmt(b)}  ->  ${fmt(v)}`);
  }
}
if (!WRITE) { console.log(`\n[dry-run] 수정 예정 ${plans.length}건. --write 필요`); await c.end(); process.exit(0); }
try {
  await c.query("BEGIN");
  for (const p of plans) {
    const keys = Object.keys(p.set);
    const sets = keys.map((k,i)=>`${k}=$${i+2}`).join(", ");
    const vals = keys.map(k => (k === "free_swim" || k === "prices") ? JSON.stringify(p.set[k]) : p.set[k]);
    await c.query(`update pools set ${sets}, updated_at=now() where id=$1`, [p.id, ...vals]);
  }
  await c.query("COMMIT");
  console.log(`\nCOMMIT 완료. ${plans.length}행 수정`);
  fs.appendFileSync("docs/data/worksplit/progress-B.jsonl",
    plans.map(p=>JSON.stringify({name:p.name,verdict:"fix",id:p.id,fields:Object.keys(p.set),reason:p.reason,collected_at:"2026-09-10"})).join("\n")+"\n");
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLBACK:", e.message); }
await c.end();
