import fs from "node:fs/promises";
import path from "node:path";

const poolsPath = process.env.POOLS_JSON_PATH ?? path.resolve("src/data/pools.json");
const outputPath = process.env.QUALITY_OUTPUT_PATH ?? path.resolve("docs/data/pool-data-quality.json");
const pools = JSON.parse(await fs.readFile(poolsPath, "utf8"));
if (!Array.isArray(pools)) throw new Error("pools.json must be an array");

const isBlank = (value) => value === null || value === undefined || value === "";
const supportedDayMap = new Map([
  ["평일", [1, 2, 3, 4, 5]],
  ["토요일", [6]],
  ["일요일", [0]],
  ["주말", [0, 6]],
  ["공휴일", [7]],
]);
const normalizeDays = (day) => {
  if (Number.isInteger(day) && day >= 0 && day <= 7) return [day];
  return supportedDayMap.get(day) ?? [];
};
const timeToMinutes = (time) => {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
const normalizeText = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const digits = (value) => typeof value === "string" ? value.replace(/\D/g, "") : "";
const isPlausibleKoreanPhone = (value) => {
  const number = digits(value);
  return /^(?:0\d{8,10}|1\d{7,8})$/.test(number);
};
const standardPhone = (value) => {
  const number = digits(value);
  if (!isPlausibleKoreanPhone(value)) return null;
  if (/^02\d{7,8}$/.test(number)) return `02-${number.slice(2, -4)}-${number.slice(-4)}`;
  if (/^0\d{9,10}$/.test(number)) return `${number.slice(0, 3)}-${number.slice(3, -4)}-${number.slice(-4)}`;
  if (/^1\d{7,8}$/.test(number)) return `${number.slice(0, 4)}-${number.slice(4)}`;
  return number;
};
const validUrl = (value) => {
  if (isBlank(value)) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};
const isEmptyObject = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;

const findings = {
  missing: {
    phone: 0,
    homepage_url: 0,
    free_swim: 0,
    price_free_swim: 0,
    prices: 0,
    facilities_empty: 0,
    subway: 0,
    images: 0,
  },
  phone: { plausible: 0, format_normalization_needed: [], invalid: [] },
  homepage: { invalid: [] },
  schedules: {
    raw_pools_with_schedule: 0,
    effective_pools_with_schedule: 0,
    pools_with_only_unsupported_days: [],
    supported_string_day_rows: 0,
    unsupported_day_rows: [],
    invalid_session_rows: [],
    overlapping_session_rows: [],
    raw_duplicate_day_rows: [],
  },
  duplicates: { same_name_address: [] },
  metadata: {
    pools_without_source_url: 0,
    pools_without_last_verified_at: 0,
    pools_without_updated_at: 0,
  },
  all_critical_missing: [],
  group_summary: [],
};
const duplicateLookup = new Map();
const groupStats = new Map();

for (const pool of pools) {
  const name = pool.name ?? "(이름 없음)";
  const address = normalizeText(pool.address);
  const key = `${normalizeText(pool.name).toLowerCase()}|${address.toLowerCase()}`;
  const duplicates = duplicateLookup.get(key) ?? [];
  duplicates.push({ id: pool.id, name, address: pool.address, phone: pool.phone, homepage_url: pool.homepage_url, lat: pool.lat, lng: pool.lng });
  duplicateLookup.set(key, duplicates);

  if (isBlank(pool.phone)) findings.missing.phone += 1;
  else if (isPlausibleKoreanPhone(pool.phone)) {
    findings.phone.plausible += 1;
    if (normalizeText(pool.phone) !== standardPhone(pool.phone)) {
      findings.phone.format_normalization_needed.push({ name, value: pool.phone, normalized: standardPhone(pool.phone) });
    }
  } else findings.phone.invalid.push({ name, value: pool.phone });

  if (isBlank(pool.homepage_url)) findings.missing.homepage_url += 1;
  else if (!validUrl(pool.homepage_url)) findings.homepage.invalid.push({ name, value: pool.homepage_url });
  if (isBlank(pool.subway)) findings.missing.subway += 1;
  if (isBlank(pool.price_free_swim)) findings.missing.price_free_swim += 1;
  if (!Array.isArray(pool.prices) || pool.prices.length === 0) findings.missing.prices += 1;
  if (isEmptyObject(pool.facilities)) findings.missing.facilities_empty += 1;
  if (!Array.isArray(pool.images) || pool.images.length === 0) findings.missing.images += 1;

  if (!Object.hasOwn(pool, "source_url")) findings.metadata.pools_without_source_url += 1;
  if (!Object.hasOwn(pool, "last_verified_at")) findings.metadata.pools_without_last_verified_at += 1;
  if (!Object.hasOwn(pool, "updated_at")) findings.metadata.pools_without_updated_at += 1;

  const rawSchedule = Array.isArray(pool.free_swim) ? pool.free_swim : [];
  if (rawSchedule.length === 0) findings.missing.free_swim += 1;
  else findings.schedules.raw_pools_with_schedule += 1;

  const sessionsByDay = new Map();
  const rawDays = new Set();
  let supportedRows = 0;
  for (const entry of rawSchedule) {
    const days = normalizeDays(entry?.day);
    if (days.length === 0) {
      findings.schedules.unsupported_day_rows.push({ name, day: entry?.day });
      continue;
    }
    supportedRows += 1;
    if (typeof entry.day === "string") findings.schedules.supported_string_day_rows += 1;
    for (const day of days) {
      if (rawDays.has(day)) findings.schedules.raw_duplicate_day_rows.push({ name, day });
      rawDays.add(day);
      const current = sessionsByDay.get(day) ?? [];
      for (const session of Array.isArray(entry.sessions) ? entry.sessions : []) {
        const start = timeToMinutes(session?.start);
        const end = timeToMinutes(session?.end);
        if (start === null || end === null || start >= end) {
          findings.schedules.invalid_session_rows.push({ name, day, session });
        } else {
          current.push({ start, end, startText: session.start, endText: session.end });
        }
      }
      sessionsByDay.set(day, current);
    }
  }
  if (rawSchedule.length > 0 && supportedRows === 0) findings.schedules.pools_with_only_unsupported_days.push(name);
  if ([...sessionsByDay.values()].some((rows) => rows.length > 0)) findings.schedules.effective_pools_with_schedule += 1;
  for (const [day, sessions] of sessionsByDay) {
    const ordered = [...sessions].sort((a, b) => a.start - b.start || a.end - b.end);
    const overlaps = ordered.filter((session, index) => index > 0 && session.start < ordered[index - 1].end);
    if (overlaps.length > 0) findings.schedules.overlapping_session_rows.push({ name, day, sessions: ordered.map(({ startText, endText }) => ({ start: startText, end: endText })) });
  }

  const region = `${pool.sido ?? "미상"} / ${pool.gu ?? "미상"}`;
  const stat = groupStats.get(region) ?? { total: 0, missing_phone: 0, missing_homepage: 0, missing_free_swim: 0, critical_missing: 0 };
  stat.total += 1;
  if (isBlank(pool.phone)) stat.missing_phone += 1;
  if (isBlank(pool.homepage_url)) stat.missing_homepage += 1;
  if (rawSchedule.length === 0) stat.missing_free_swim += 1;
  if (isBlank(pool.phone) && isBlank(pool.homepage_url) && rawSchedule.length === 0) {
    stat.critical_missing += 1;
    findings.all_critical_missing.push({ name, sido: pool.sido, gu: pool.gu, address: pool.address, price_free_swim: pool.price_free_swim });
  }
  groupStats.set(region, stat);
}

findings.duplicates.same_name_address = [...duplicateLookup.values()].filter((records) => records.length > 1);
findings.group_summary = [...groupStats.entries()]
  .map(([region, values]) => ({ region, ...values }))
  .sort((a, b) => b.critical_missing - a.critical_missing || b.missing_free_swim - a.missing_free_swim || b.total - a.total);

const report = {
  generated_at: new Date().toISOString(),
  pool_count: pools.length,
  findings,
  summary: {
    missing: findings.missing,
    phone_invalid_count: findings.phone.invalid.length,
    phone_format_normalization_needed_count: findings.phone.format_normalization_needed.length,
    invalid_homepage_count: findings.homepage.invalid.length,
    effective_free_swim_pool_count: findings.schedules.effective_pools_with_schedule,
    only_unsupported_schedule_pool_count: findings.schedules.pools_with_only_unsupported_days.length,
    unsupported_day_row_count: findings.schedules.unsupported_day_rows.length,
    invalid_session_row_count: findings.schedules.invalid_session_rows.length,
    overlapping_schedule_day_count: findings.schedules.overlapping_session_rows.length,
    duplicate_name_address_group_count: findings.duplicates.same_name_address.length,
    all_critical_missing_count: findings.all_critical_missing.length,
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  summary: report.summary,
  duplicate_groups: findings.duplicates.same_name_address,
  top_regions: findings.group_summary.slice(0, 15),
  invalid_phone_examples: findings.phone.invalid.slice(0, 20),
  unsupported_day_examples: findings.schedules.unsupported_day_rows.slice(0, 20),
  invalid_session_examples: findings.schedules.invalid_session_rows.slice(0, 20),
  overlap_examples: findings.schedules.overlapping_session_rows.slice(0, 20),
  critical_missing_examples: findings.all_critical_missing.slice(0, 30),
}, null, 2));
