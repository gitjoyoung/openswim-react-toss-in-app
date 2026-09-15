import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const WRITE = process.argv.includes("--write");
const DAY = { "일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6,"공휴일":7 };
const decisions = JSON.parse(fs.readFileSync("docs/data/worksplit/C-conflict-decisions.json","utf8"));
const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const plans = [];
for (const d of decisions) {
  const k = (await c.query("select * from pools where name=$1",[d.keep])).rows;
  const drops = (await c.query("select * from pools where name = any($1)",[d.drop])).rows;
  if (k.length !== 1) { console.log(`건너뜀 ${d.group}: 유지 대상 ${k.length}행`); continue; }
  const set = { ...d.set };
  if (set.free_swim) set.free_swim = set.free_swim.map(x => ({ day: DAY[x.day] ?? x.day,
    sessions: (x.sessions||[]).map(s => { const [a,b]=s.split("-"); return { start:a, end:b }; }) }));
  plans.push({ group: d.group, keepId: k[0].id, keepName: k[0].name, before: k[0], set,
    drops: drops.map(x => ({ id: x.id, name: x.name })), reason: d.reason, quote: d.quote, evidence: d.evidence });
  const slots = (v) => (v||[]).reduce((s,x)=>s+(x.sessions?.length??0),0);
  console.log(`\n### ${d.group}`);
  console.log(`  유지: ${k[0].name}   삭제: ${drops.map(x=>x.name).join(", ")}`);
  console.log(`  근거: ${d.evidence}`);
  console.log(`  인용: ${d.quote.slice(0,120)}`);
  console.log(`  판단: ${d.reason.slice(0,150)}`);
  if (set.free_swim) console.log(`  자유수영: ${slots(k[0].free_swim)}회차 -> ${slots(set.free_swim)}회차`);
  console.log(`  confidence: ${k[0].free_swim_confidence} -> ${set.free_swim_confidence}`);
}
if (!WRITE) { console.log(`\n[dry-run] ${plans.length}그룹`); await c.end(); process.exit(0); }
const before = Number((await c.query("select count(*) n from pools")).rows[0].n);
const dropIds = plans.flatMap(p=>p.drops.map(d=>d.id));
fs.writeFileSync("docs/data/conflict-merge-backup-2026-09-10.json",
  JSON.stringify(plans.map(p=>({group:p.group, keepBefore:p.before, dropped:p.drops})), null, 1));
try {
  await c.query("BEGIN");
  for (const p of plans) {
    const keys = Object.keys(p.set);
    const vals = keys.map(k => k === "free_swim" ? JSON.stringify(p.set[k]) : p.set[k]);
    await c.query(`update pools set ${keys.map((k,i)=>`${k}=$${i+2}`).join(", ")}, updated_at=now() where id=$1`, [p.keepId, ...vals]);
    if (p.drops.length) await c.query("delete from pools where id = any($1)", [p.drops.map(d=>d.id)]);
  }
  const after = Number((await c.query("select count(*) n from pools")).rows[0].n);
  if (after !== before - dropIds.length) throw new Error(`행수 불일치 ${before} -> ${after}`);
  await c.query("COMMIT");
  console.log(`\nCOMMIT 완료. ${before} -> ${after}`);
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLBACK:", e.message); }
await c.end();
