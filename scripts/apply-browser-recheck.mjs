// 브라우저 렌더링 수집 결과를 출처 필드에 반영한다. 자유수영 시간 값은 바꾸지 않는다.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const analysis = JSON.parse(fs.readFileSync("tmp/browser-analysis.json","utf8"));
const all = fs.readFileSync("tmp/browser-recheck.jsonl","utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));
const byId = Object.fromEntries(analysis.map(a=>[a.id,a]));
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
let stats={};
for (const r of all) {
  const a = byId[r.id];
  let conf, note;
  if (!a) {
    conf="needs_check";
    note = r.status==="ok" ? "브라우저 렌더링으로도 자유수영 시간표 못 찾음, 전화 확인 필요" : "공식 사이트 접근 실패, 전화 확인 필요";
  } else if (a.verdict==="전부 확인") { conf="high"; note=`브라우저 렌더링 공식 페이지에서 전체 시간 확인 (line ${a.line})`; }
  else if (a.verdict==="일부 확인") { conf="medium"; note=`브라우저 렌더링 공식 페이지에서 일부 확인 (line ${a.line})`; }
  else { conf="needs_check"; note=`공식 페이지 자유수영 시간과 DB 값이 다름 (line ${a.line})`; }
  await c.query(`update public.pools set free_swim_confidence=$2, free_swim_note=$3, free_swim_verified_at='2026-09-02'::date where id=$1`, [r.id, conf, note]);
  stats[conf]=(stats[conf]??0)+1;
}
console.log("반영:", JSON.stringify(stats));
const s = await c.query(`select free_swim_confidence conf, count(*)::int c from public.pools
                         where free_swim is not null and free_swim::text not in ('null','[]','{}') group by 1 order by 2 desc`);
for (const x of s.rows) console.log("  ", x.conf ?? "(없음)", x.c);
await c.end();
