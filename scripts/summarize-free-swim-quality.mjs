import fs from "node:fs/promises";
import path from "node:path";

const qualityPath = process.env.QUALITY_PATH ?? path.resolve("docs/data/pool-data-quality.json");
const poolsPath = process.env.POOLS_JSON_PATH ?? path.resolve("src/data/pools.json");
const quality = JSON.parse(await fs.readFile(qualityPath, "utf8"));
const pools = JSON.parse(await fs.readFile(poolsPath, "utf8"));

const supportedDayMap = new Map([
  ["평일", [1, 2, 3, 4, 5]], ["토요일", [6]], ["일요일", [0]], ["주말", [0, 6]], ["공휴일", [7]],
]);
const normalizeDays = (day) => Number.isInteger(day) && day >= 0 && day <= 7 ? [day] : (supportedDayMap.get(day) ?? []);
const dayTotals = new Map([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]]);
let priceWithoutSchedule = 0;
let scheduleWithoutPrice = 0;
let scheduleWithContactGap = 0;
for (const pool of pools) {
  const rows = Array.isArray(pool.free_swim) ? pool.free_swim : [];
  const effective = rows.some((row) => normalizeDays(row?.day).length > 0 && Array.isArray(row.sessions) && row.sessions.length > 0);
  if (effective) {
    const days = new Set(rows.flatMap((row) => normalizeDays(row?.day)));
    for (const day of days) dayTotals.set(day, (dayTotals.get(day) ?? 0) + 1);
  }
  if (pool.price_free_swim != null && !effective) priceWithoutSchedule += 1;
  if (pool.price_free_swim == null && effective) scheduleWithoutPrice += 1;
  if (effective && (!pool.phone || !pool.homepage_url)) scheduleWithContactGap += 1;
}

const overlapsByPool = [...quality.findings.schedules.overlapping_session_rows.reduce((map, row) => {
  const days = map.get(row.name) ?? [];
  days.push(row.day);
  map.set(row.name, days);
  return map;
}, new Map()).entries()].map(([name, days]) => ({ name, day_count: days.length, days }));

console.log(JSON.stringify({
  effective_free_swim_pool_count: quality.summary.effective_free_swim_pool_count,
  missing_free_swim_pool_count: quality.summary.missing.free_swim,
  weekly_day_coverage: Object.fromEntries(dayTotals),
  price_without_schedule_count: priceWithoutSchedule,
  schedule_without_price_count: scheduleWithoutPrice,
  schedule_with_phone_or_homepage_gap_count: scheduleWithContactGap,
  overlap: {
    affected_pool_count: overlapsByPool.length,
    affected_day_count: quality.summary.overlapping_schedule_day_count,
    pools: overlapsByPool,
  },
  normalizer: {
    supported_string_day_rows: quality.findings.schedules.supported_string_day_rows,
    unsupported_day_rows: quality.summary.unsupported_day_row_count,
    invalid_session_rows: quality.summary.invalid_session_row_count,
  },
}, null, 2));
