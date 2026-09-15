// DB 정합성 감사. 읽기 전용. 좌표·주소·요금·연락처·행정구역 일관성을 본다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query("select id,name,sido,gu,address,phone,lat,lng,homepage_url,price_free_swim,free_swim from pools")).rows;
await c.end();

const dist = (a,b,c2,d) => { const R=6371000,t=x=>x*Math.PI/180; const dl=t(c2-a),dg=t(d-b);
  const h=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c2))*Math.sin(dg/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const median = (a) => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
const issues = [];
const add = (rule, row, detail) => issues.push({ rule, id: row.id, name: row.name, sido: row.sido, gu: row.gu, detail });

// 1. 좌표가 한반도 밖
for (const r of rows) {
  if (r.lat == null || r.lng == null) { add("좌표없음", r, ""); continue; }
  if (r.lat < 33 || r.lat > 39 || r.lng < 124.5 || r.lng > 132) add("좌표범위이탈", r, `${r.lat}, ${r.lng}`);
}
// 2. 같은 시도 중앙값에서 크게 벗어난 좌표
const bySido = new Map();
for (const r of rows) if (r.lat != null) { if (!bySido.has(r.sido)) bySido.set(r.sido, []); bySido.get(r.sido).push(r); }
for (const [sido, list] of bySido) {
  if (list.length < 5) continue;
  const mlat = median(list.map(x=>x.lat)), mlng = median(list.map(x=>x.lng));
  for (const r of list) {
    const d = dist(r.lat, r.lng, mlat, mlng);
    // 울릉군·옹진군 등 도서지역은 본토 중앙값에서 멀 수밖에 없다
    if (/울릉|옹진|신안|완도|진도/.test(r.gu ?? "")) continue;
    const limit = /특별시|광역시|특별자치시/.test(sido) ? 40000 : 160000;
    if (d > limit) add("좌표-시도 불일치", r, `${sido} 중앙값에서 ${Math.round(d/1000)}km — 좌표 ${r.lat.toFixed(4)},${r.lng.toFixed(4)}`);
  }
}
// 3. 주소 앞머리 시도와 sido 컬럼 불일치
const sidoAlias = { "서울":"서울특별시","부산":"부산광역시","대구":"대구광역시","인천":"인천광역시","광주":"광주광역시","대전":"대전광역시","울산":"울산광역시","세종":"세종특별자치시","경기":"경기도","강원":"강원특별자치도","충북":"충청북도","충남":"충청남도","전북":"전북특별자치도","전남":"전라남도","경북":"경상북도","경남":"경상남도","제주":"제주특별자치도" };
for (const r of rows) {
  const head = String(r.address ?? "").trim().split(/\s+/)[0];
  if (!head) continue;
  const norm = sidoAlias[head.slice(0,2)] ?? head;
  // 축약형(경기)과 전체명(경상북도) 둘 다 허용한다
  if (norm !== r.sido && head !== r.sido) add("주소-시도 불일치", r, `주소 "${head}" vs sido "${r.sido}"`);
}
// 4. 좌표 완전 동일한 서로 다른 시설
const coordKey = new Map();
for (const r of rows) if (r.lat != null) {
  const k = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
  if (!coordKey.has(k)) coordKey.set(k, []); coordKey.get(k).push(r);
}
const roadOf = (s) => { const m = String(s ?? "").match(/([가-힣A-Za-z0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/); return m ? m[1]+m[2] : null; };
for (const [k, list] of coordKey) {
  if (list.length < 2) continue;
  // 같은 도로명 주소면 한 건물 안 복수 시설이라 정상
  if (new Set(list.map((x) => roadOf(x.address))).size === 1 && roadOf(list[0].address)) continue;
  add("좌표 완전중복", list[0], `${list.length}행 동일 좌표(${k}): ${list.map(x=>x.name).join(" / ")}`);
}
// 5. 요금 이상치
for (const r of rows) {
  if (r.price_free_swim == null) continue;
  if (r.price_free_swim > 20000) add("요금 과다", r, `${r.price_free_swim}원 — 월권/오타 의심`);
  if (r.price_free_swim > 0 && r.price_free_swim < 500) add("요금 과소", r, `${r.price_free_swim}원`);
}
// 6. 시설명에 수영장과 무관한 표현
for (const r of rows) if (/충전소|주차장|테니스|골프|파크골프|야구장/.test(r.name)) add("시설명 이상", r, r.name);
// 7. gu 값에 시도가 섞이거나 공백 포함
for (const r of rows) {
  if (!r.gu) { add("gu 없음", r, ""); continue; }
  if (/특별시|광역시|도$/.test(r.gu)) add("gu 형식오류", r, `gu="${r.gu}"`);
  if (/\s/.test(r.gu) && !/^(고양시|성남시|수원시|안산시|안양시|용인시|전주시|창원시|천안시|청주시|포항시|화성시)\s/.test(r.gu)) add("gu 형식오류", r, `gu="${r.gu}"`);
}
// 8. 전화 형식
// 0507 안심번호와 15xx/16xx/18xx 대표번호는 정상 형식이다
const PHONE_OK = [/^0\d{1,2}-\d{3,4}-\d{4}$/, /^0507-\d{4}-\d{4}$/, /^1[5-9]\d{2}-\d{4}$/];
for (const r of rows) if (r.phone && !PHONE_OK.some((re) => re.test(r.phone))) add("전화 형식오류", r, r.phone);

const byRule = {};
for (const i of issues) (byRule[i.rule] ??= []).push(i);
fs.writeFileSync("docs/data/db-integrity-audit.json", JSON.stringify({ auditedAt: new Date().toISOString(), total: rows.length, issueCount: issues.length, byRule }, null, 1));
console.log(`전체 ${rows.length}행 | 정합성 지적 ${issues.length}건\n`);
for (const [rule, list] of Object.entries(byRule).sort((a,b)=>b[1].length-a[1].length)) {
  console.log(`[${rule}] ${list.length}건`);
  for (const i of list.slice(0, 8)) console.log(`   - ${i.name} (${i.sido} ${i.gu}) ${i.detail}`);
  if (list.length > 8) console.log(`   ... 외 ${list.length - 8}건`);
  console.log("");
}
