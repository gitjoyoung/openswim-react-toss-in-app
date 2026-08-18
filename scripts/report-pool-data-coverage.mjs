import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pools = JSON.parse(await readFile(path.join(root, "src/data/pools.json"), "utf8"));
const audit = JSON.parse(await readFile(path.join(root, "docs/data/pool-source-audit.json"), "utf8"));
const noSchedule = pools.filter((pool) => !Array.isArray(pool.free_swim) || pool.free_swim.length === 0);
const noPrice = pools.filter((pool) => pool.price_free_swim == null);

const compact = (pool) => ({
  id: pool.id,
  name: pool.name,
  sido: pool.sido,
  gu: pool.gu,
  address: pool.address,
});

const report = {
  checkedAt: "2026-08-03",
  totalPools: pools.length,
  auditedUpdates: audit.length,
  withSchedule: pools.length - noSchedule.length,
  withoutVerifiedScheduleCount: noSchedule.length,
  withPrice: pools.length - noPrice.length,
  withoutVerifiedPriceCount: noPrice.length,
  note: "미확인 항목에는 자유수영 미운영·회원 전용 가능 시설이 포함됩니다. 시설 영업시간은 자유수영 시간으로 간주하지 않았습니다.",
  withoutVerifiedSchedule: noSchedule.map(compact),
  withoutVerifiedPrice: noPrice.map(compact),
};

const output = path.join(root, "docs/data/pool-data-coverage.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${output}: 시간표 미확인 ${noSchedule.length}, 요금 미확인 ${noPrice.length}`);
