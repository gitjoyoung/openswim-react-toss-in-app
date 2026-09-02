// pools 테이블에 자유수영 데이터의 필드 단위 출처 정보를 추가하고 백필한다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const data = JSON.parse(fs.readFileSync(process.env.BACKFILL ?? "tmp/provenance-backfill.json","utf8"));
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();

await c.query(`
  alter table public.pools
    add column if not exists free_swim_source      text,
    add column if not exists free_swim_source_type text,
    add column if not exists free_swim_verified_at date,
    add column if not exists free_swim_confidence  text,
    add column if not exists free_swim_note        text
`);
console.log("컬럼 추가 완료");

let n = 0;
for (const [id, v] of Object.entries(data)) {
  const r = await c.query(
    `update public.pools set
       free_swim_source = $2, free_swim_source_type = $3,
       free_swim_verified_at = $4::date, free_swim_confidence = $5, free_swim_note = $6
     where id = $1`,
    [id, v.source_url ?? null, v.source_type ?? null, v.verified_at ?? null, v.confidence ?? null, v.note ?? null],
  );
  n += r.rowCount;
}
console.log("백필 완료:", n);

const s = await c.query(`select free_swim_source_type t, free_swim_confidence conf, count(*)::int c
                         from public.pools group by 1,2 order by 3 desc`);
for (const r of s.rows) console.log(" ", r.t ?? "(없음)", "|", r.conf ?? "(없음)", "|", r.c);
await c.end();
