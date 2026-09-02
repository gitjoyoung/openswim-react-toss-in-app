// 재조사 결과를 pools 테이블의 출처 필드에 반영한다. 자유수영 시간 값 자체는 바꾸지 않는다.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const rows = JSON.parse(fs.readFileSync("tmp/reanalysis.json","utf8"));
const TODAY = "2026-09-02";
const c = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();

let stats = {};
for (const r of rows) {
  let conf, note;
  if (r.verdict === "DB 전부 공식 문서에서 확인") {
    conf = "high"; note = `공식 페이지에서 전체 시간 확인 (${path.basename(path.dirname(r.evidenceFile))} 수집)`;
  } else if (r.verdict === "일부만 공식 문서에서 확인") {
    conf = "medium"; note = `공식 페이지에서 일부 확인, 미확인 ${r.missing.length}건`;
  } else if (r.verdict.startsWith("충돌")) {
    conf = "needs_check"; note = "공식 페이지: 평일 자유수영 불가 표기와 DB 평일 데이터가 충돌";
  } else if (r.verdict === "공식 문서에서 DB 시간 확인 불가") {
    conf = "needs_check"; note = "공식 페이지의 자유수영 시간과 DB 값이 다름, 재확인 필요";
  } else if (r.verdict === "자유수영 언급만 있고 시간 없음") {
    conf = "needs_check"; note = "공식 페이지에 자유수영 언급만 있고 시간표 없음";
  } else {
    conf = "needs_check"; note = "공식 페이지에서 자유수영 근거 못 찾음 (JS 렌더링/전화 확인 필요)";
  }
  const src = ["official_gov","official_pub"].includes(classify(r.homepage)) ? r.homepage : r.homepage;
  await c.query(
    `update public.pools set free_swim_confidence=$2, free_swim_note=$3,
            free_swim_verified_at=$4::date, free_swim_source=coalesce($5, free_swim_source),
            free_swim_source_type=$6
       where id=$1`,
    [r.id, conf, note, TODAY, src, classify(r.homepage)],
  );
  stats[conf] = (stats[conf] ?? 0) + 1;
}
function classify(u) {
  u = String(u ?? "");
  if (/https?:\/\/[^/]*\.go\.kr/.test(u)) return "official_gov";
  if (/https?:\/\/[^/]*\.or\.kr/.test(u)) return "official_pub";
  if (/oneul-swim|helloswim|swimmingis|hello109|25m\.kr/.test(u)) return "aggregator";
  if (/blog\.naver|tistory/.test(u)) return "blog";
  return u.startsWith("http") ? "operator_site" : "unknown";
}
console.log("반영:", JSON.stringify(stats));
const s = await c.query(`select free_swim_confidence conf, count(*)::int c from public.pools
                         where free_swim is not null and free_swim::text not in ('null','[]','{}')
                         group by 1 order by 2 desc`);
for (const x of s.rows) console.log("  ", x.conf ?? "(없음)", x.c);
await c.end();
