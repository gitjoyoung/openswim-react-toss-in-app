import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const POOLS_PATH = path.join(ROOT, "src/data/pools.json");
const CACHE_PATH = path.join(ROOT, "tmp/pool-research/swimmingis.json");
const SITEMAP_URL = "https://swimmingis.com/sitemap.xml";
const REFRESH = process.argv.includes("--refresh");

const normalizeName = (value = "") =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/수영장|실내수영|수영/g, "")
    .replace(/[\s·._()\-/]/g, "")
    .toLowerCase();

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

function decodeEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseDetail(id, lastModified, html) {
  const titleMatch = html.match(/<title>Swimming is #([\s\S]*?) #자유수영<\/title>/);
  if (!titleMatch) return null;

  const decoded = html.replace(/\\"/g, '"');
  const rowsMatch = decoded.match(/"timeAndPriceList":(\[[\s\S]*?\])/);
  let rows = [];
  try {
    rows = rowsMatch ? JSON.parse(rowsMatch[1]) : [];
  } catch {
    return null;
  }

  const coordinateMatch = html.match(/\/map\?c=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const lat = coordinateMatch ? Number(coordinateMatch[1]) : null;
  const lng = coordinateMatch ? Number(coordinateMatch[2]) : null;

  const sessionsByDay = new Map();
  for (const row of rows) {
    const sourceDay = Number(row.dayOfTheWeek);
    const day = sourceDay === 7 ? 0 : sourceDay;
    const start = String(row.beginTime ?? "").slice(0, 5);
    const end = String(row.endTime ?? "").slice(0, 5);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    const key = `${start}-${end}`;
    const sessions = sessionsByDay.get(day) ?? new Map();
    sessions.set(key, { start, end });
    sessionsByDay.set(day, sessions);
  }

  const freeSwim = [...sessionsByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }));

  const adultPrices = rows
    .map((row) => row.adultPrice ?? row.price)
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    id,
    name: decodeEntities(titleMatch[1]),
    lat,
    lng,
    freeSwim,
    price: adultPrices.length ? Math.min(...adultPrices) : null,
    sourceUrl: `https://swimmingis.com/detail/${id}`,
    sourceLastModified: lastModified,
  };
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
  const pages = [...sitemap.matchAll(/detail\/(\d+)<\/loc><lastmod>([^<]+)/g)].map((match) => ({
    id: Number(match[1]),
    lastModified: match[2],
  }));

  const sources = (
    await mapConcurrent(pages, 5, async ({ id, lastModified }, index) => {
      if (index % 50 === 0) console.error(`수집 ${index}/${pages.length}`);
      try {
        const response = await fetch(`https://swimmingis.com/detail/${id}`);
        if (!response.ok) return null;
        return parseDetail(id, lastModified, await response.text());
      } catch {
        return null;
      }
    })
  ).filter(Boolean);

  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(sources), "utf8");
  return sources;
}

function scoreMatch(pool, source) {
  const localName = normalizeName(pool.name);
  const sourceName = normalizeName(source.name);
  const distance = distanceMeters(pool, source);
  let score = 0;

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
const unknownPools = pools.filter(
  (pool) => !Array.isArray(pool.free_swim) || pool.free_swim.length === 0 || pool.price_free_swim == null,
);

const candidates = [];
for (const pool of unknownPools) {
  const ranked = sources
    .map((source) => ({ source, ...scoreMatch(pool, source) }))
    .filter(({ source, score }) => score >= 120 && (source.freeSwim.length || source.price != null))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  if (!ranked.length) continue;
  const best = ranked[0];
  candidates.push({
    poolId: pool.id,
    poolName: pool.name,
    sourceName: best.source.name,
    distanceMeters: Number.isFinite(best.distance) ? Math.round(best.distance) : null,
    sourceLastModified: best.source.sourceLastModified,
    sourceUrl: best.source.sourceUrl,
    canFillSchedule:
      (!Array.isArray(pool.free_swim) || pool.free_swim.length === 0) && best.source.freeSwim.length > 0,
    canFillPrice: pool.price_free_swim == null && best.source.price != null,
  });
}

const recent = candidates.filter(({ sourceLastModified }) => sourceLastModified >= "2024-01-01");
console.log(
  JSON.stringify(
    {
      localPools: pools.length,
      sourcePages: sources.length,
      candidates: candidates.length,
      recentCandidates: recent.length,
      scheduleCandidates: candidates.filter((candidate) => candidate.canFillSchedule).length,
      priceCandidates: candidates.filter((candidate) => candidate.canFillPrice).length,
      recent,
    },
    null,
    2,
  ),
);
