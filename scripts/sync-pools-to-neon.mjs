// pools.json 을 Neon 의 public.pools 에 upsert 한다.
// 스키마/권한은 이미 구성돼 있다고 가정하고 데이터만 동기화한다.
// (최초 스키마 생성은 .manus/neon-migration/migrate_pools_to_neon.mjs 참고)
//
// 사용법:
//   set -a; source .env; set +a
//   node scripts/sync-pools-to-neon.mjs [--dry-run]

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// pg 는 앱 런타임 의존성이 아니라서 마이그레이션 폴더의 것을 재사용한다.
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const connectionString = process.env.NEON_DATABASE_URL;
const poolsPath = process.env.POOLS_JSON_PATH ?? path.resolve("src/data/pools.json");
const dryRun = process.argv.includes("--dry-run");

if (!connectionString) throw new Error("NEON_DATABASE_URL 이 설정되지 않았습니다");

const pools = JSON.parse(await fs.readFile(poolsPath, "utf8"));
if (!Array.isArray(pools) || pools.length === 0) {
  throw new Error("pools.json 이 비어 있거나 배열이 아닙니다");
}

const ids = new Set();
for (const [index, pool] of pools.entries()) {
  if (!pool || typeof pool !== "object") throw new Error(`index ${index}: 객체가 아님`);
  if (typeof pool.id !== "string" || !pool.id) throw new Error(`index ${index}: id 없음`);
  if (ids.has(pool.id)) throw new Error(`중복 id: ${pool.id}`);
  if (typeof pool.name !== "string" || !pool.name) throw new Error(`${pool.id}: name 없음`);
  if (typeof pool.gu !== "string" || !pool.gu) throw new Error(`${pool.id}: gu 없음`);
  ids.add(pool.id);
}

const withSchedule = pools.filter((p) => Array.isArray(p.free_swim) && p.free_swim.length > 0).length;
console.log(`로컬: ${pools.length}곳, 시간표 보유 ${withSchedule}곳`);

if (dryRun) {
  console.log("--dry-run 이므로 여기서 종료합니다.");
  process.exit(0);
}

const columns = [
  "id", "name", "sido", "gu", "address", "lat", "lng", "phone",
  "homepage_url", "subway", "price_free_swim", "price_note",
  "prices", "facilities", "free_swim", "images",
];

const asText = (v) => (typeof v === "string" && v.trim() ? v : null);
const asNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asJson = (v, fallback) => JSON.stringify(v ?? fallback);
const asImages = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

const toValues = (p) => [
  p.id, p.name, asText(p.sido), p.gu, asText(p.address), asNum(p.lat), asNum(p.lng),
  asText(p.phone), asText(p.homepage_url), asText(p.subway), asNum(p.price_free_swim),
  asText(p.price_note), asJson(p.prices, []), asJson(p.facilities, {}),
  asJson(p.free_swim, []), asImages(p.images),
];

const updateClause = columns
  .filter((c) => c !== "id")
  .map((c) => `${c} = EXCLUDED.${c}`)
  .concat("updated_at = now()")
  .join(", ");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 20_000,
  statement_timeout: 60_000,
});

const batchSize = 100;

try {
  await client.connect();
  await client.query("BEGIN");

  const before = await client.query(`
    SELECT count(*)::integer AS total,
           count(*) FILTER (WHERE free_swim <> '[]'::jsonb)::integer AS with_schedule
    FROM public.pools
  `);

  for (let offset = 0; offset < pools.length; offset += batchSize) {
    const batch = pools.slice(offset, offset + batchSize);
    const placeholders = [];
    const values = [];
    for (const pool of batch) {
      const row = toValues(pool);
      const start = values.length;
      placeholders.push(`(${row.map((_, i) => `$${start + i + 1}`).join(", ")})`);
      values.push(...row);
    }
    await client.query(
      `INSERT INTO public.pools (${columns.join(", ")})
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO UPDATE SET ${updateClause};`,
      values,
    );
  }

  const after = await client.query(`
    SELECT count(*)::integer AS total,
           count(*) FILTER (WHERE free_swim <> '[]'::jsonb)::integer AS with_schedule,
           count(*) FILTER (WHERE price_free_swim IS NOT NULL)::integer AS with_price,
           count(*) FILTER (WHERE phone IS NULL OR phone = '')::integer AS missing_phone
    FROM public.pools
  `);

  if (after.rows[0].total !== pools.length) {
    throw new Error(`행 수 불일치: 기대 ${pools.length}, 실제 ${after.rows[0].total}`);
  }

  await client.query("COMMIT");
  console.log(JSON.stringify({
    before: before.rows[0],
    after: after.rows[0],
    scheduleGain: after.rows[0].with_schedule - before.rows[0].with_schedule,
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
