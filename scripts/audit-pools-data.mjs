import fs from "node:fs/promises";
import path from "node:path";

const poolsPath = process.env.POOLS_JSON_PATH ?? path.resolve("src/data/pools.json");
const outputPath = process.env.AUDIT_OUTPUT_PATH ?? path.resolve("docs/data/pool-data-audit.json");
const raw = await fs.readFile(poolsPath, "utf8");
const pools = JSON.parse(raw);

if (!Array.isArray(pools)) throw new Error("pools.json must be an array");

const isBlank = (value) => value === null || value === undefined || value === "";
const validUrl = (value) => {
  if (isBlank(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
const timeToMinutes = (time) => {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const normalized = (value) => typeof value === "string" ? value.replace(/\s+/g, "").trim().toLowerCase() : "";
const fieldNames = [
  "id", "name", "sido", "gu", "address", "lat", "lng", "phone", "homepage_url",
  "subway", "price_free_swim", "price_note", "prices", "facilities", "free_swim", "images",
];

const missing = Object.fromEntries(fieldNames.map((field) => [field, 0]));
const invalid = {
  id: [],
  coordinates: [],
  homepage_url: [],
  phone: [],
  price_rows: [],
  free_swim_rows: [],
};
const idCounts = new Map();
const nameAddressCounts = new Map();
const groupStats = new Map();
const priorityCandidates = [];
let freeSwimPoolCount = 0;
let freeSwimSessionCount = 0;
let freeSwimDayCount = 0;
let rowsWithoutSessions = 0;

for (const pool of pools) {
  for (const field of fieldNames) {
    const value = pool[field];
    if (isBlank(value) || (Array.isArray(value) && value.length === 0)) missing[field] += 1;
  }

  const id = typeof pool.id === "string" ? pool.id : "";
  idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  if (!id) invalid.id.push(pool.name ?? "(이름 없음)");

  const nameAddressKey = `${normalized(pool.name)}|${normalized(pool.address)}`;
  nameAddressCounts.set(nameAddressKey, (nameAddressCounts.get(nameAddressKey) ?? 0) + 1);

  const coordinatesPresent = Number.isFinite(pool.lat) && Number.isFinite(pool.lng);
  if (!coordinatesPresent || pool.lat < 33 || pool.lat > 39.7 || pool.lng < 124 || pool.lng > 132) {
    invalid.coordinates.push(pool.name ?? "(이름 없음)");
  }
  if (!validUrl(pool.homepage_url)) invalid.homepage_url.push({ name: pool.name, value: pool.homepage_url });
  if (!isBlank(pool.phone) && (typeof pool.phone !== "string" || !/^(0\d{1,2}|1\d{3,4})-?\d{3,4}-\d{4}$/.test(pool.phone.replace(/\s/g, "")))) {
    invalid.phone.push({ name: pool.name, value: pool.phone });
  }

  const groupKey = `${pool.sido ?? "미상"} / ${pool.gu ?? "미상"}`;
  const stat = groupStats.get(groupKey) ?? { total: 0, missing_phone: 0, missing_homepage: 0, missing_free_swim: 0, missing_all_priority: 0 };
  stat.total += 1;
  if (isBlank(pool.phone)) stat.missing_phone += 1;
  if (isBlank(pool.homepage_url)) stat.missing_homepage += 1;
  if (!Array.isArray(pool.free_swim) || pool.free_swim.length === 0) stat.missing_free_swim += 1;

  const missingCriticalCount = [pool.phone, pool.homepage_url].filter(isBlank).length + (!Array.isArray(pool.free_swim) || pool.free_swim.length === 0 ? 1 : 0);
  if (missingCriticalCount === 3) {
    stat.missing_all_priority += 1;
    priorityCandidates.push({
      name: pool.name,
      sido: pool.sido,
      gu: pool.gu,
      address: pool.address,
      lat: pool.lat,
      lng: pool.lng,
      price_free_swim: pool.price_free_swim,
    });
  }
  groupStats.set(groupKey, stat);

  if (Array.isArray(pool.prices)) {
    for (const price of pool.prices) {
      if (!price || typeof price.label !== "string" || !Number.isFinite(price.amount) || price.amount < 0) {
        invalid.price_rows.push({ name: pool.name, value: price });
      }
    }
  }

  if (Array.isArray(pool.free_swim) && pool.free_swim.length > 0) {
    freeSwimPoolCount += 1;
    const daySet = new Set();
    for (const row of pool.free_swim) {
      const errors = [];
      if (!row || !Number.isInteger(row.day) || row.day < 0 || row.day > 7) errors.push("invalid_day");
      if (daySet.has(row?.day)) errors.push("duplicate_day");
      daySet.add(row?.day);
      if (!Array.isArray(row?.sessions) || row.sessions.length === 0) {
        rowsWithoutSessions += 1;
        errors.push("missing_sessions");
      } else {
        freeSwimDayCount += 1;
        const ranges = [];
        for (const session of row.sessions) {
          const start = timeToMinutes(session?.start);
          const end = timeToMinutes(session?.end);
          if (start === null || end === null || start >= end) {
            errors.push("invalid_session_time");
          } else {
            ranges.push({ start, end });
            freeSwimSessionCount += 1;
          }
        }
        ranges.sort((a, b) => a.start - b.start);
        if (ranges.some((range, index) => index > 0 && range.start < ranges[index - 1].end)) errors.push("overlapping_sessions");
      }
      if (errors.length > 0) invalid.free_swim_rows.push({ name: pool.name, day: row?.day, errors });
    }
  }
}

const duplicateIds = [...idCounts.entries()].filter(([id, count]) => id && count > 1).map(([id, count]) => ({ id, count }));
const duplicateNameAddresses = [...nameAddressCounts.entries()]
  .filter(([key, count]) => !key.startsWith("|") && !key.endsWith("|") && count > 1)
  .map(([key, count]) => ({ key, count }));

const compareNeon = async () => {
  const dataApiUrl = process.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, "");
  const authUrl = process.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");
  if (!dataApiUrl || !authUrl) return { attempted: false, reason: "public_neon_environment_variables_not_set" };

  const tokenResponse = await fetch(`${authUrl}/token/anonymous`);
  if (!tokenResponse.ok) return { attempted: true, available: false, reason: `token_request_${tokenResponse.status}` };
  const tokenPayload = await tokenResponse.json();
  if (typeof tokenPayload?.token !== "string") return { attempted: true, available: false, reason: "invalid_token_response" };

  const url = new URL(`${dataApiUrl}/pools`);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${tokenPayload.token}` } });
  if (!response.ok) return { attempted: true, available: false, reason: `data_api_request_${response.status}` };
  const neonRows = await response.json();
  if (!Array.isArray(neonRows)) return { attempted: true, available: false, reason: "invalid_data_api_response" };

  const localIds = new Set(pools.map((pool) => pool.id));
  const neonIds = new Set(neonRows.map((row) => row?.id));
  return {
    attempted: true,
    available: true,
    local_count: localIds.size,
    neon_count: neonIds.size,
    missing_in_neon: [...localIds].filter((id) => !neonIds.has(id)).length,
    extra_in_neon: [...neonIds].filter((id) => !localIds.has(id)).length,
  };
};

const audit = {
  generated_at: new Date().toISOString(),
  source: { path: poolsPath, pool_count: pools.length },
  neon_sync: await compareNeon(),
  completeness: {
    missing,
    free_swim_pool_count: freeSwimPoolCount,
    free_swim_day_count: freeSwimDayCount,
    free_swim_session_count: freeSwimSessionCount,
    free_swim_rows_without_sessions: rowsWithoutSessions,
  },
  integrity: {
    duplicate_id_count: duplicateIds.length,
    duplicate_ids: duplicateIds,
    duplicate_name_address_count: duplicateNameAddresses.length,
    duplicate_name_addresses: duplicateNameAddresses,
    invalid_coordinate_count: invalid.coordinates.length,
    invalid_homepage_url_count: invalid.homepage_url.length,
    invalid_phone_count: invalid.phone.length,
    invalid_price_row_count: invalid.price_rows.length,
    invalid_free_swim_row_count: invalid.free_swim_rows.length,
    examples: {
      invalid_coordinates: invalid.coordinates.slice(0, 20),
      invalid_homepage_urls: invalid.homepage_url.slice(0, 20),
      invalid_phones: invalid.phone.slice(0, 20),
      invalid_price_rows: invalid.price_rows.slice(0, 20),
      invalid_free_swim_rows: invalid.free_swim_rows.slice(0, 30),
    },
  },
  priority: {
    groups: [...groupStats.entries()]
      .map(([region, stats]) => ({ region, ...stats }))
      .sort((a, b) => b.missing_all_priority - a.missing_all_priority || b.missing_free_swim - a.missing_free_swim || b.total - a.total),
    all_critical_missing_count: priorityCandidates.length,
    all_critical_missing_examples: priorityCandidates.slice(0, 100),
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  pool_count: audit.source.pool_count,
  neon_sync: audit.neon_sync,
  missing: audit.completeness.missing,
  integrity: {
    duplicate_id_count: audit.integrity.duplicate_id_count,
    duplicate_name_address_count: audit.integrity.duplicate_name_address_count,
    invalid_coordinate_count: audit.integrity.invalid_coordinate_count,
    invalid_homepage_url_count: audit.integrity.invalid_homepage_url_count,
    invalid_phone_count: audit.integrity.invalid_phone_count,
    invalid_price_row_count: audit.integrity.invalid_price_row_count,
    invalid_free_swim_row_count: audit.integrity.invalid_free_swim_row_count,
  },
  all_critical_missing_count: audit.priority.all_critical_missing_count,
  output_path: outputPath,
}, null, 2));
