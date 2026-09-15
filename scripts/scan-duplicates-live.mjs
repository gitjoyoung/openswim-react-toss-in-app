// 라이브 Neon 전체 행 기준 중복 후보 스캔. 읽기 전용. 리포트만 낸다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const pools = (await c.query("select id,name,sido,gu,address,phone,lat,lng,homepage_url,free_swim,price_free_swim,free_swim_confidence,free_swim_source,images,updated_at from pools order by name")).rows;
await c.end();

const digits = (s) => String(s ?? "").replace(/\D/g, "");
// 이름 정규화: 괄호·영문병기·시설 접미어 제거
const normName = (v) => String(v ?? "")
  .replace(/\([^)]*\)/g, "")
  .replace(/[A-Za-z]{3,}/g, "")
  .replace(/수영장|실내수영|실내|스포츠센터|체육센터|국민체육|문화센터|복지관|수련관|센터|풀장|수영/g, "")
  .replace(/[\s·._\-\/,]/g, "").toLowerCase();
// 도로명 + 건물번호
const roadKey = (s) => {
  const m = String(s ?? "").match(/([가-힣A-Za-z0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/);
  return m ? m[1] + m[2] : null;
};
const dist = (a, b, c2, d) => {
  if ([a, b, c2, d].some((v) => v == null)) return Infinity;
  const R = 6371000, t = (x) => (x * Math.PI) / 180;
  const dl = t(c2 - a), dg = t(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c2)) * Math.sin(dg / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const hasFs = (p) => (p.free_swim ?? []).some((d) => (d.sessions ?? []).length > 0);
// 정보량 점수: 병합 시 어느 쪽을 남길지 판단용
const score = (p) => (hasFs(p) ? 40 : 0) + (p.price_free_swim != null ? 10 : 0) + (p.phone ? 8 : 0)
  + (p.homepage_url ? 8 : 0) + (p.free_swim_source ? 10 : 0)
  + ({ high: 12, medium: 8, low: 4, needs_check: 1 }[p.free_swim_confidence] ?? 0)
  + ((p.images ?? []).length ? 6 : 0) + (p.address ? 2 : 0);

// 확인 완료된 "서로 다른 시설" 조합은 건너뛴다
let WHITELIST = [];
try {
  WHITELIST = JSON.parse(fs.readFileSync("docs/data/pool-duplicate-whitelist.json", "utf8")).pairs
    .map((p) => new Set(p.names));
} catch { /* 화이트리스트가 없으면 전체 스캔 */ }
const whitelisted = (a, b) => WHITELIST.some((s) => s.has(a) && s.has(b));

const pairs = [];
for (let i = 0; i < pools.length; i++) {
  for (let j = i + 1; j < pools.length; j++) {
    const a = pools[i], b = pools[j];
    const reasons = [];
    const d = dist(a.lat, a.lng, b.lat, b.lng);
    const pa = digits(a.phone), pb = digits(b.phone);
    const ra = roadKey(a.address), rb = roadKey(b.address);
    const na = normName(a.name), nb = normName(b.name);

    if (pa.length >= 9 && pa === pb) reasons.push("전화일치");
    if (ra && ra === rb) reasons.push("도로명일치");
    if (d < 120) reasons.push(`좌표${Math.round(d)}m`);
    if (na && na.length >= 2 && na === nb && d < 3000) reasons.push("이름일치");
    if (na && nb && na !== nb && na.length >= 3 && (na.includes(nb) || nb.includes(na)) && d < 500) reasons.push("이름포함");

    if (!reasons.length) continue;
    if (whitelisted(a.name, b.name)) continue;
    // 근거 2개 이상이거나, 전화/도로명 단독이면 후보
    const strong = reasons.length >= 2 || reasons.some((r) => r === "전화일치" || r === "도로명일치");
    if (!strong) continue;
    pairs.push({ a, b, reasons, meters: Number.isFinite(d) ? Math.round(d) : null });
  }
}

// 연결 요소로 그룹핑
const parent = new Map(pools.map((p) => [p.id, p.id]));
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const union = (x, y) => { const rx = find(x), ry = find(y); if (rx !== ry) parent.set(rx, ry); };
for (const p of pairs) union(p.a.id, p.b.id);

const groups = new Map();
for (const p of pairs) {
  const k = find(p.a.id);
  if (!groups.has(k)) groups.set(k, { members: new Map(), reasons: new Set() });
  const g = groups.get(k);
  g.members.set(p.a.id, p.a); g.members.set(p.b.id, p.b);
  p.reasons.forEach((r) => g.reasons.add(r));
}

const out = [];
for (const [, g] of groups) {
  const ms = [...g.members.values()].sort((x, y) => score(y) - score(x));
  out.push({
    reasons: [...g.reasons],
    keep: { id: ms[0].id, name: ms[0].name, score: score(ms[0]) },
    members: ms.map((m) => ({ id: m.id, name: m.name, sido: m.sido, gu: m.gu, address: m.address, phone: m.phone,
      lat: m.lat, lng: m.lng, homepage_url: m.homepage_url, score: score(m),
      freeSwimDays: (m.free_swim ?? []).filter((d) => (d.sessions ?? []).length).length,
      freeSwimSlots: (m.free_swim ?? []).reduce((s, d) => s + (d.sessions?.length ?? 0), 0),
      price: m.price_free_swim, confidence: m.free_swim_confidence, source: m.free_swim_source,
      images: (m.images ?? []).length })),
  });
}
out.sort((a, b) => b.members.length - a.members.length || b.keep.score - a.keep.score);

fs.mkdirSync("docs/data", { recursive: true });
fs.writeFileSync("docs/data/pool-duplicates-live.json",
  JSON.stringify({ scannedAt: new Date().toISOString(), total: pools.length, groups: out.length,
    affectedRows: out.reduce((s, g) => s + g.members.length, 0), duplicateGroups: out }, null, 1));

console.log(`전체 ${pools.length}행 | 중복 후보 그룹 ${out.length}개 | 관련 행 ${out.reduce((s,g)=>s+g.members.length,0)}개\n`);
for (const g of out) {
  console.log(`[${g.reasons.join(",")}]`);
  for (const m of g.members) {
    const mark = m.id === g.keep.id ? "유지" : "  후보";
    console.log(`  ${mark} ${String(m.score).padStart(3)}점 | ${m.name} (${m.gu}) | 자유수영 ${m.freeSwimDays}일 ${m.freeSwimSlots}회차 | 요금 ${m.price ?? "-"} | ${m.address ?? ""}`);
  }
  console.log("");
}
