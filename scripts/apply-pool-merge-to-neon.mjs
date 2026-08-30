// 병합으로 삭제된 중복 수영장을 Neon 에서도 제거한다.
// pool_reviews 는 on delete cascade 라서, 먼저 후기를 대표 레코드로 옮긴 뒤 삭제한다.
// (sync-pools-to-neon.mjs 는 upsert 만 하므로 삭제는 이 스크립트가 담당한다)
//
// 사용법:
//   set -a; source .env; set +a
//   node scripts/apply-pool-merge-to-neon.mjs [--dry-run]
// 실행 후 node scripts/sync-pools-to-neon.mjs 로 나머지 변경분을 반영한다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const connectionString = process.env.NEON_DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");
if (!connectionString) throw new Error("NEON_DATABASE_URL 이 설정되지 않았습니다");

const log = JSON.parse(await readFile(path.resolve("docs/data/pool-merge-log.json"), "utf8"));
const pools = JSON.parse(await readFile(path.resolve("src/data/pools.json"), "utf8"));
const keptIds = new Set(pools.map((pool) => pool.id));

const plan = log.merges.map((merge) => ({ keep: merge.keep, remove: merge.removed, name: merge.name }));
const removeIds = plan.flatMap((entry) => entry.remove);

for (const entry of plan) {
  if (!keptIds.has(entry.keep)) throw new Error(`대표 레코드가 pools.json 에 없습니다: ${entry.keep}`);
  for (const id of entry.remove) {
    if (keptIds.has(id)) throw new Error(`삭제 대상이 아직 pools.json 에 있습니다: ${id}`);
  }
}

console.log(`삭제 대상 ${removeIds.length}건 / 대표 ${plan.length}곳`);
if (dryRun) {
  for (const entry of plan) console.log(`  ${entry.name} <- ${entry.remove.join(", ")}`);
  console.log("--dry-run 이므로 DB 를 변경하지 않습니다.");
  process.exit(0);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 20_000,
  statement_timeout: 60_000,
});

try {
  await client.connect();
  await client.query("BEGIN");

  const hasReviews = await client.query(`SELECT to_regclass('public.pool_reviews') IS NOT NULL AS ok`);
  let movedReviews = 0;
  if (hasReviews.rows[0].ok) {
    for (const entry of plan) {
      const result = await client.query(
        `UPDATE public.pool_reviews SET pool_id = $1 WHERE pool_id = ANY($2::uuid[])`,
        [entry.keep, entry.remove],
      );
      movedReviews += result.rowCount;
    }
  }

  const deleted = await client.query(
    `DELETE FROM public.pools WHERE id = ANY($1::uuid[])`,
    [removeIds],
  );

  const total = await client.query(`SELECT count(*)::integer AS total FROM public.pools`);
  await client.query("COMMIT");
  console.log(JSON.stringify({ movedReviews, deleted: deleted.rowCount, poolsAfter: total.rows[0].total }, null, 2));
  console.log("이어서 node scripts/sync-pools-to-neon.mjs 를 실행하세요.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
