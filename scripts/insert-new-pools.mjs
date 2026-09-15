// 신규 시설 등록 전용. UPDATE/DELETE 를 절대 하지 않는다 (worksplit 세션 B 규칙).
// 사용: set -a; source .env; set +a; node scripts/insert-new-pools.mjs [--write]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const WRITE = process.argv.includes("--write");
const SRC = process.env.SRC ?? "docs/data/worksplit/B-register.json";
const DAY = { "일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6,"공휴일":7 };

const rows = JSON.parse(fs.readFileSync(SRC, "utf8"));
const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();

const existing = (await c.query("select id,name,address,phone,lat,lng from pools")).rows;
const digits = s => String(s||"").replace(/\D/g,"");
const roadKey = s => { const m=String(s||"").match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/); return m? m[1]+m[2] : null; };
const dist=(a,b,c2,d)=>{if([a,b,c2,d].some(v=>v==null))return Infinity;const R=6371000,t=x=>x*Math.PI/180;const dl=t(c2-a),dg=t(d-b);const h=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c2))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h));};

let blocked = 0, planned = [];
for (const r of rows) {
  // 등록 직전 마지막 중복 방어선
  const dup = existing.filter(e =>
    (digits(r.phone).length>=9 && digits(e.phone)===digits(r.phone)) ||
    (roadKey(r.address) && roadKey(e.address)===roadKey(r.address)) ||
    dist(e.lat,e.lng,r.lat,r.lng) < 200);
  if (dup.length) { blocked++; console.log(`차단 | ${r.name} | 중복 후보: ${dup.map(d=>d.name).join(", ")}`); continue; }
  const free_swim = (r.free_swim ?? []).map(d => ({ day: DAY[d.day] ?? d.day, sessions: (d.sessions??[]).map(s=>{const [a,b]=String(s).split(/[-~]/);return {start:a.trim(),end:b.trim()};}) }));
  planned.push({
    id: crypto.randomUUID(), name: r.name, sido: r.sido, gu: r.gu, address: r.address,
    lat: r.lat, lng: r.lng, phone: r.phone ?? null, homepage_url: r.homepage_url ?? null,
    subway: null, price_free_swim: r.price_free_swim ?? null, price_note: r.price_note ?? null,
    // prices / facilities / free_swim / images 는 NOT NULL 컬럼이라 기본값을 채운다
    prices: r.prices ?? (r.price_free_swim != null ? [{ label: "1일권", amount: r.price_free_swim }] : []),
    facilities: r.facilities ?? {},
    free_swim, images: [],
    free_swim_source: r.free_swim_source ?? null,
    free_swim_source_type: r.free_swim_source_type ?? "unknown",
    free_swim_verified_at: r.free_swim_verified_at ?? null,
    free_swim_confidence: r.free_swim_confidence ?? "needs_check",
    free_swim_note: r.free_swim_note ?? null,
  });
}

console.log(`\n등록 예정 ${planned.length}건 / 중복 차단 ${blocked}건`);
for (const p of planned) console.log(` + ${p.sido} ${p.gu} ${p.name} | 자유수영 ${p.free_swim.length? p.free_swim.length+'일':'없음'} | 요금 ${p.price_free_swim ?? '없음'} | prices ${JSON.stringify(p.prices)} | conf ${p.free_swim_confidence}`);

if (!WRITE) { console.log("\n[dry-run] --write 를 붙여야 실제로 INSERT 한다."); await c.end(); process.exit(0); }

const before = Number((await c.query("select count(*) n from pools")).rows[0].n);
try {
  await c.query("BEGIN");
  for (const p of planned) {
    await c.query(
      `insert into pools (id,name,sido,gu,address,lat,lng,phone,homepage_url,subway,price_free_swim,price_note,prices,facilities,free_swim,images,free_swim_source,free_swim_source_type,free_swim_verified_at,free_swim_confidence,free_swim_note,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now())`,
      [p.id,p.name,p.sido,p.gu,p.address,p.lat,p.lng,p.phone,p.homepage_url,p.subway,p.price_free_swim,p.price_note,
       JSON.stringify(p.prices), JSON.stringify(p.facilities),
       JSON.stringify(p.free_swim), p.images,
       p.free_swim_source,p.free_swim_source_type,p.free_swim_verified_at,p.free_swim_confidence,p.free_swim_note]);
  }
  const after = Number((await c.query("select count(*) n from pools")).rows[0].n);
  if (after - before !== planned.length) throw new Error(`행수 불일치: ${before} -> ${after}, 기대 +${planned.length}`);
  await c.query("COMMIT");
  console.log(`\nCOMMIT 완료. ${before} -> ${after}`);
  fs.appendFileSync("docs/data/worksplit/progress-B.jsonl",
    planned.map(p=>JSON.stringify({name:p.name,verdict:"register",new_id:p.id,collected_at:new Date().toISOString().slice(0,10)})).join("\n")+"\n");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("ROLLBACK:", e.message);
}
await c.end();
