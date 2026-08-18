import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const POOLS_PATH = path.join(ROOT, "src/data/pools.json");
const CACHE_PATH = path.join(ROOT, "tmp/pool-research/oneul-swim.json");
const AUDIT_PATH = path.join(ROOT, "docs/data/pool-source-audit.json");
const SITEMAP_URL = "https://oneul-swim.vercel.app/sitemap.xml";
const WRITE = process.argv.includes("--write");
const REFRESH = process.argv.includes("--refresh");

const normalizeName = (value = "") =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/수영장|실내수영|수영/g, "")
    .replace(/[\s·._()\-/]/g, "")
    .toLowerCase();

const normalizeSido = (value = "") =>
  value.replace(/특별자치도|특별자치시|특별시|광역시|자치도|도|시/g, "").replace(/\s/g, "");

const radians = (degrees) => (degrees * Math.PI) / 180;
const distanceMeters = (a, b) => {
  if ([a.lat, a.lng, b.lat, b.lng].some((value) => value == null)) return Infinity;
  const earthRadius = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

function extractPool(html) {
  const decoded = html.replace(/\\"/g, '"');
  const markerIndex = decoded.indexOf('"pool":{');
  if (markerIndex < 0) return null;
  const start = decoded.indexOf("{", markerIndex + 7);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < decoded.length; index += 1) {
    const char = decoded[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(decoded.slice(start, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchSources() {
  if (!REFRESH) {
    try {
      return JSON.parse(await readFile(CACHE_PATH, "utf8"));
    } catch {
      // 캐시가 없으면 아래에서 새로 수집한다.
    }
  }

  const sitemap = await (await fetch(SITEMAP_URL)).text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/oneul-swim\.vercel\.app\/pool\/[^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );
  const sources = (
    await mapConcurrent(urls, 5, async (url, index) => {
      if (index % 50 === 0) console.error(`수집 ${index}/${urls.length}`);
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const pool = extractPool(await response.text());
        return pool ? { ...pool, pageUrl: url } : null;
      } catch {
        return null;
      }
    })
  ).filter(Boolean);

  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(sources), "utf8");
  return sources;
}

function toFreeSwim(source) {
  const sessionsByDay = new Map();
  for (const session of source.freeSwim?.sessions ?? []) {
    const label = String(session.daysLabel ?? "");
    const dayCodes = label.includes("공휴일") ? [7] : (session.dayCodes ?? []);
    for (const day of dayCodes) {
      if (!Number.isInteger(day) || day < 0 || day > 7) continue;
      const start = String(session.start ?? "").slice(0, 5);
      const end = String(session.end ?? "").slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
      const sessions = sessionsByDay.get(day) ?? new Map();
      sessions.set(`${start}-${end}`, { start, end });
      sessionsByDay.set(day, sessions);
    }
  }
  return [...sessionsByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }));
}

function adultPrice(source) {
  for (const fee of Object.values(source.fees ?? {})) {
    const amount = fee?.성인;
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
}

function priceTiers(source) {
  const full = source.fees?.full;
  if (!full || typeof full !== "object") return [];
  return Object.entries(full)
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .map(([label, amount]) => ({ label, amount }));
}

function scoreMatch(pool, source) {
  const localName = normalizeName(pool.name);
  const sourceName = normalizeName(source.name);
  const distance = distanceMeters(pool, source);
  let score = 0;
  const regionMismatch =
    (pool.sido && source.sido && normalizeSido(pool.sido) !== normalizeSido(source.sido)) ||
    (pool.gu && source.sigungu && pool.gu !== source.sigungu);
  // 지역 표기가 부정확한 기존 행도 좌표가 가까우면 허용하되, 멀리 떨어진 동명 시설은 제외한다.
  if (regionMismatch && distance > 300) return { score: -1, distance };
  if (localName && localName === sourceName) score += 120;
  else if (
    localName.length >= 5 &&
    sourceName.length >= 5 &&
    (localName.includes(sourceName) || sourceName.includes(localName))
  ) {
    score += 80;
  }
  if (distance <= 40) score += 100;
  else if (distance <= 120) score += 60;
  else if (distance <= 300) score += 20;
  return { score, distance };
}

const pools = JSON.parse(await readFile(POOLS_PATH, "utf8"));
const sources = await fetchSources();
const changes = [];

for (const pool of pools) {
  const needsSchedule = !Array.isArray(pool.free_swim) || pool.free_swim.length === 0;
  const needsPrice = pool.price_free_swim == null;
  if (!needsSchedule && !needsPrice) continue;

  const ranked = sources
    .map((source) => ({ source, ...scoreMatch(pool, source) }))
    .filter(({ source, score }) => score >= 120 && (toFreeSwim(source).length || adultPrice(source) != null))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  if (!ranked.length) continue;

  const { source, distance } = ranked[0];
  const schedule = toFreeSwim(source);
  const price = adultPrice(source);
  const fields = [];

  if (needsSchedule && schedule.length) {
    pool.free_swim = schedule;
    fields.push("free_swim");
  }
  if (needsPrice && price != null) {
    pool.price_free_swim = price;
    if (!Array.isArray(pool.prices) || pool.prices.length === 0) pool.prices = priceTiers(source);
    fields.push("price_free_swim", "prices");
  }
  if (!pool.homepage_url && source.sourceUrl) {
    pool.homepage_url = source.sourceUrl;
    fields.push("homepage_url");
  }
  if (!pool.phone && source.phone) {
    pool.phone = source.phone;
    fields.push("phone");
  }
  if (!fields.length) continue;

  changes.push({
    poolId: pool.id,
    poolName: pool.name,
    matchedName: source.name,
    distanceMeters: Number.isFinite(distance) ? Math.round(distance) : null,
    fields: [...new Set(fields)],
    checkedAt: new Date().toISOString().slice(0, 10),
    sourceUpdatedAt: source.updatedAt,
    sourcePage: source.pageUrl,
    primarySource: source.sourceUrl || null,
  });
}

console.log(
  JSON.stringify(
    {
      localPools: pools.length,
      sourcePools: sources.length,
      matchedChanges: changes.length,
      schedulesFilled: changes.filter(({ fields }) => fields.includes("free_swim")).length,
      pricesFilled: changes.filter(({ fields }) => fields.includes("price_free_swim")).length,
      sample: changes.slice(0, 30),
    },
    null,
    2,
  ),
);

if (WRITE) {
  await writeFile(POOLS_PATH, JSON.stringify(pools), "utf8");
  await mkdir(path.dirname(AUDIT_PATH), { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await readFile(AUDIT_PATH, "utf8"));
  } catch {
    // 첫 감사 기록 생성.
  }
  const byPool = new Map(existing.map((entry) => [entry.poolId, entry]));
  for (const change of changes) byPool.set(change.poolId, change);
  await writeFile(AUDIT_PATH, `${JSON.stringify([...byPool.values()], null, 2)}\n`, "utf8");
  console.error(`${changes.length}개 시설을 반영했습니다.`);
}
