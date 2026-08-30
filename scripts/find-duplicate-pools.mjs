// 이름/주소/좌표를 정규화해 중복 후보 수영장을 전수 조사한다.
// 사용법: node scripts/find-duplicate-pools.mjs [--json]
//
// 판정은 자동으로 하지 않는다. 여기서는 "후보 그룹"만 뽑고,
// 실제 병합 대상은 docs/data/pool-duplicate-decisions.json 에서 사람이 확정한다.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const poolsPath = path.resolve("src/data/pools.json");
const outPath = path.resolve("docs/data/pool-duplicates.json");

/** 이름 비교용: 공백·괄호·기호 제거 후 소문자화 */
export const normalizeName = (value) =>
  (value ?? "").replace(/[\s()（）[\]·・.,'"’‘“”\-_/]/g, "").toLowerCase();

const SIDO_ALIASES = [
  [/^(서울특별시|서울시|서울)/, "서울"],
  [/^(부산광역시|부산시|부산)/, "부산"],
  [/^(대구광역시|대구시|대구)/, "대구"],
  [/^(인천광역시|인천시|인천)/, "인천"],
  [/^(광주광역시|광주시|광주)/, "광주"],
  [/^(대전광역시|대전시|대전)/, "대전"],
  [/^(울산광역시|울산시|울산)/, "울산"],
  [/^(세종특별자치시|세종시|세종)/, "세종"],
  [/^(경기도|경기)/, "경기"],
  [/^(강원특별자치도|강원도|강원)/, "강원"],
  [/^(충청북도|충북)/, "충북"],
  [/^(충청남도|충남)/, "충남"],
  [/^(전북특별자치도|전라북도|전북)/, "전북"],
  [/^(전라남도|전남)/, "전남"],
  [/^(경상북도|경북)/, "경북"],
  [/^(경상남도|경남)/, "경남"],
  [/^(제주특별자치도|제주도|제주)/, "제주"],
];

/**
 * 주소 비교용: 시도 표기를 통일하고 도로명 주소의 핵심(도로명 + 건물번호)만 남긴다.
 * "경기도 시흥시 정왕대로233번길 33" -> "경기정왕대로233번길33"
 * 건물명·동호수 등 뒤쪽 군더더기는 버린다.
 */
export const normalizeAddress = (value) => {
  if (!value) return "";
  let text = value.replace(/\s+/g, " ").trim();
  let sido = "";
  for (const [pattern, canonical] of SIDO_ALIASES) {
    if (pattern.test(text)) {
      sido = canonical;
      text = text.replace(pattern, "").trim();
      break;
    }
  }
  // 번길이 있으면 번길 번호까지 포함해야 서로 다른 주소가 뭉개지지 않는다.
  const road =
    text.match(/[가-힣A-Za-z0-9]+(?:대로|로|길)\s?\d+번길\s?\d+(?:-\d+)?/) ??
    text.match(/[가-힣A-Za-z0-9]+(?:대로|로|길)\s?\d+(?:-\d+)?/);
  return normalizeName(sido + (road ? road[0] : text));
};

/** 두 좌표 사이 거리(m). 좌표가 없으면 Infinity */
export const distanceMeters = (a, b) => {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every((v) => typeof v === "number")) return Infinity;
  const R = 6371000;
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** 한쪽 이름이 다른 쪽에 통째로 들어있는지 (예: 고양체육관 ⊂ 고양체육관수영장) */
const nameContains = (a, b) => a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));

export function findDuplicatePairs(pools) {
  const meta = pools.map((pool) => ({
    pool,
    name: normalizeName(pool.name),
    address: normalizeAddress(pool.address),
  }));

  const pairs = [];
  for (let i = 0; i < meta.length; i += 1) {
    for (let j = i + 1; j < meta.length; j += 1) {
      const a = meta[i];
      const b = meta[j];
      const sameName = a.name === b.name;
      const sameAddress = Boolean(a.address) && a.address === b.address;
      const meters = distanceMeters(a.pool, b.pool);
      const near = meters < 200;
      const overlap = !sameName && nameContains(a.name, b.name);

      // 주소나 좌표 중 하나라도 붙어 있어야 후보로 본다.
      // 이름만 같은 경우(동명이인 국민체육센터)는 지역이 다르면 후보에서 뺀다.
      const colocated = sameAddress || near;
      if (!colocated && !(sameName && a.pool.sido === b.pool.sido)) continue;

      const reasons = [];
      if (sameName) reasons.push("이름 동일");
      if (sameAddress) reasons.push("주소 동일");
      if (near) reasons.push(`좌표 ${Math.round(meters)}m`);
      if (overlap) reasons.push("이름 포함");

      const score = (sameName ? 3 : 0) + (sameAddress ? 2 : 0) + (near ? 2 : 0) + (overlap ? 1 : 0);
      if (score < 3) continue;
      pairs.push({ a: a.pool, b: b.pool, score, reasons, meters });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

/** 후보 쌍을 연결 요소(그룹)로 묶는다. */
export function groupPairs(pairs) {
  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)));
      id = parent.get(id);
    }
    return id;
  };
  const union = (x, y) => parent.set(find(x), find(y));
  for (const pair of pairs) union(pair.a.id, pair.b.id);

  const groups = new Map();
  for (const pair of pairs) {
    const key = find(pair.a.id);
    if (!groups.has(key)) groups.set(key, { members: new Map(), reasons: new Set() });
    const group = groups.get(key);
    group.members.set(pair.a.id, pair.a);
    group.members.set(pair.b.id, pair.b);
    for (const reason of pair.reasons) group.reasons.add(reason);
  }
  return [...groups.values()].map((group) => ({
    members: [...group.members.values()],
    reasons: [...group.reasons],
  }));
}

/** 정보가 가장 많은 레코드를 대표로 고른다. */
export const richness = (pool) =>
  [
    (pool.free_swim ?? []).length > 0,
    (pool.prices ?? []).length > 0,
    pool.price_free_swim != null,
    Boolean(pool.homepage_url),
    Boolean(pool.phone),
    (pool.images ?? []).length > 0,
    Boolean(pool.subway),
    Boolean(pool.price_note),
    Boolean(pool.address),
    Object.keys(pool.facilities ?? {}).length > 0,
  ].filter(Boolean).length;

const pools = JSON.parse(await readFile(poolsPath, "utf8"));
const groups = groupPairs(findDuplicatePairs(pools)).sort(
  (a, b) => b.members.length - a.members.length,
);

const report = groups.map((group) => ({
  reasons: group.reasons,
  members: group.members
    .map((pool) => ({
      id: pool.id,
      name: pool.name,
      sido: pool.sido ?? "",
      gu: pool.gu,
      address: pool.address ?? "",
      richness: richness(pool),
      freeSwimDays: (pool.free_swim ?? []).length,
    }))
    .sort((a, b) => b.richness - a.richness),
}));

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`수영장 ${pools.length}곳 / 중복 후보 ${groups.length}그룹 ${groups.reduce((n, g) => n + g.members.length, 0)}건`);
for (const group of report) {
  console.log(`\n- ${group.reasons.join(", ")}`);
  for (const m of group.members) {
    console.log(`  ${m.id} | ${m.name} | ${m.sido} ${m.gu} | ${m.address} | 필드${m.richness} 요일${m.freeSwimDays}`);
  }
}
console.log(`\n리포트: ${path.relative(process.cwd(), outPath)}`);
