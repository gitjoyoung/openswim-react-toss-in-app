// docs/data/pool-duplicate-decisions.json 의 확정 내역대로 pools.json 의 중복을 병합한다.
// 대표 레코드는 유지하고, 중복 레코드의 정보 중 대표에 비어 있는 값만 채운 뒤 중복을 제거한다.
// 사용법: node scripts/merge-duplicate-pools.mjs [--dry-run]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const poolsPath = path.resolve("src/data/pools.json");
const decisionsPath = path.resolve("docs/data/pool-duplicate-decisions.json");
const logPath = path.resolve("docs/data/pool-merge-log.json");
const dryRun = process.argv.includes("--dry-run");

const SIDO = new Set([
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
  "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도",
  "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
]);

// 정식 명칭과 약칭 모두 정상 주소로 인정한다.
const SIDO_PREFIXES = [
  ...SIDO,
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

/** 주소의 첫 토큰이 실재하는 시도 표기인지 (부분 일치는 인정하지 않는다) */
const startsWithKnownSido = (address) =>
  typeof address === "string" && SIDO_PREFIXES.includes(address.trim().split(/\s+/)[0]);

const isEmpty = (value) =>
  value == null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);

/** 요일 단위로 자유수영 시간표를 합친다. 대표에 있는 요일은 대표 값을 유지한다. */
const mergeFreeSwim = (keeper, donor) => {
  const byDay = new Map();
  for (const entry of donor ?? []) if (entry?.day != null) byDay.set(entry.day, entry);
  for (const entry of keeper ?? []) if (entry?.day != null) byDay.set(entry.day, entry);
  return [...byDay.values()].sort((a, b) => a.day - b.day);
};

const pools = JSON.parse(await readFile(poolsPath, "utf8"));
const { merges, rejected } = JSON.parse(await readFile(decisionsPath, "utf8"));
const byId = new Map(pools.map((pool) => [pool.id, pool]));

// 같은 시(市) 안에서 다수가 쓰는 gu 표기를 정본으로 삼는다.
// ("안산시" 11건 vs "안산시 단원구" 1건 -> 지역 필터에 유령 항목이 생긴다)
const guCount = new Map();
for (const pool of pools) guCount.set(pool.gu, (guCount.get(pool.gu) ?? 0) + 1);
const canonicalGu = (gu) => {
  const city = gu.split(" ")[0];
  let best = gu;
  for (const [candidate, count] of guCount) {
    if (candidate !== city && candidate !== gu) continue;
    if (count > (guCount.get(best) ?? 0)) best = candidate;
  }
  return best;
};

const log = [];
const removed = new Set();

for (const merge of merges) {
  const keeper = byId.get(merge.keep);
  if (!keeper) throw new Error(`대표 레코드 없음: ${merge.keep}`);

  const filled = [];
  for (const removeId of merge.remove) {
    const donor = byId.get(removeId);
    if (!donor) throw new Error(`중복 레코드 없음: ${removeId}`);

    for (const field of [
      "phone", "homepage_url", "subway", "price_note", "price_free_swim",
      "prices", "images", "facilities", "address", "lat", "lng",
    ]) {
      if (isEmpty(keeper[field]) && !isEmpty(donor[field])) {
        keeper[field] = structuredClone(donor[field]);
        filled.push(`${field}<-${removeId.slice(0, 8)}`);
      }
    }

    const before = (keeper.free_swim ?? []).length;
    keeper.free_swim = mergeFreeSwim(keeper.free_swim, donor.free_swim);
    if (keeper.free_swim.length > before) filled.push(`free_swim+${keeper.free_swim.length - before}일`);

    // 시도 표기가 깨진 대표 레코드는 중복 쪽의 정상 표기를 쓴다.
    if (!SIDO.has(keeper.sido ?? "") && SIDO.has(donor.sido ?? "")) {
      filled.push(`sido:${keeper.sido}->${donor.sido}`);
      keeper.sido = donor.sido;
    }

    // 주소 앞머리가 실재하지 않는 행정구역이면(예: "전남광주통합특별시") 정상 주소로 바꾼다.
    if (!startsWithKnownSido(keeper.address) && startsWithKnownSido(donor.address)) {
      filled.push(`address:${keeper.address}->${donor.address}`);
      keeper.address = donor.address;
    }
    removed.add(removeId);
  }

  if (merge.keepName && merge.keepName !== keeper.name) {
    filled.push(`name:${keeper.name}->${merge.keepName}`);
    keeper.name = merge.keepName;
  }

  log.push({
    keep: keeper.id,
    name: keeper.name,
    removed: merge.remove,
    filled,
    evidence: merge.evidence,
  });
}

// 병합과 무관한 레코드까지 포함해 gu 표기를 정본으로 통일한다.
const guFixes = [];
for (const pool of pools) {
  if (removed.has(pool.id)) continue;
  const canonical = canonicalGu(pool.gu);
  if (canonical !== pool.gu) {
    guFixes.push({ id: pool.id, name: pool.name, from: pool.gu, to: canonical });
    pool.gu = canonical;
  }
}

const next = pools.filter((pool) => !removed.has(pool.id));

console.log(`병합 ${merges.length}그룹 / 삭제 ${removed.size}건 / 거부 ${rejected.length}건`);
console.log(`수영장 ${pools.length} -> ${next.length}곳`);
for (const entry of log) {
  console.log(`  ${entry.name}: ${entry.removed.length}건 흡수 ${entry.filled.length ? `(${entry.filled.join(", ")})` : "(보충 없음)"}`);
}
console.log(`gu 표기 정규화 ${guFixes.length}건`);
for (const fix of guFixes) console.log(`  ${fix.name}: ${fix.from} -> ${fix.to}`);

if (dryRun) {
  console.log("--dry-run 이므로 파일을 쓰지 않습니다.");
  process.exit(0);
}

await writeFile(poolsPath, `${JSON.stringify(next, null, 2)}\n`);
await writeFile(logPath, `${JSON.stringify({ mergedAt: new Date().toISOString(), merges: log, guFixes, rejected }, null, 2)}\n`);
console.log(`\n반영 완료. 로그: ${path.relative(process.cwd(), logPath)}`);
