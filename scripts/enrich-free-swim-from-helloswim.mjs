import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const poolsPath = path.join(root, "src/data/pools.json");
const cachePath = path.join(root, "tmp/pool-research/helloswim.json");
const auditPath = path.join(root, "docs/data/pool-source-audit.json");
const sitemapUrl = "https://www.helloswim.kr/sitemaps/pools.xml";
const write = process.argv.includes("--write");
const refresh = process.argv.includes("--refresh");

const normalizeName = (value = "") =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/수영장|실내수영|수영/g, "")
    .replace(/[\s·._()\-/]/g, "")
    .toLowerCase();

const radians = (degrees) => (degrees * Math.PI) / 180;
function distanceMeters(a, b) {
  const bLat = b.latitude;
  const bLng = b.longitude;
  if ([a.lat, a.lng, bLat, bLng].some((value) => value == null)) return Infinity;
  const earthRadius = 6_371_000;
  const dLat = radians(bLat - a.lat);
  const dLng = radians(bLng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function extractPool(html) {
  const match = html.match(/\\"pool\\":(\{.*?\}),\\"seoHeading/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\"));
  } catch {
    return null;
  }
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
  if (!refresh) {
    try {
      return JSON.parse(await readFile(cachePath, "utf8"));
    } catch {
      // 캐시가 없으면 공개 상세 페이지에서 수집한다.
    }
  }

  const sitemap = await (await fetch(sitemapUrl)).text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.helloswim\.kr\/pool\/\d+)<\/loc>/g)].map(
    (match) => match[1],
  );
  const sources = (
    await mapConcurrent(urls, 6, async (url, index) => {
      if (index % 100 === 0) console.error(`수집 ${index}/${urls.length}`);
      try {
        const response = await fetch(url, { headers: { "user-agent": "ChatGPT-User" } });
        if (!response.ok) return null;
        const pool = extractPool(await response.text());
        return pool ? { ...pool, pageUrl: url } : null;
      } catch {
        return null;
      }
    })
  ).filter(Boolean);

  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(sources), "utf8");
  return sources;
}

const time = (value) => (/^\d{2}:\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 5) : null);
const dayKeys = [
  [0, "sun"],
  [1, "mon"],
  [2, "tue"],
  [3, "wed"],
  [4, "thu"],
  [5, "fri"],
  [6, "sat"],
  [7, "holiday"],
];

function toFreeSwim(source) {
  const active = (source.programs ?? []).find(
    (program) => program.program_type === "free_swim" && program.is_active !== false,
  );
  if (!active) return [];
  const data = active.schedule_data ?? {};
  const byDay = new Map();
  const add = (days, startValue, endValue) => {
    const start = time(startValue);
    const end = time(endValue);
    if (!start || !end || start >= end) return;
    for (const day of days) {
      const sessions = byDay.get(day) ?? new Map();
      sessions.set(`${start}-${end}`, { start, end });
      byDay.set(day, sessions);
    }
  };
  const addTimes = (days, value) => {
    for (const range of value?.times ?? []) {
      const [start, end] = String(range).split("-");
      add(days, start, end);
    }
  };

  // 상세 프로그램에 저장된 대표적인 구조들을 보수적으로 지원한다.
  for (const session of data.sessions ?? data.time_slots ?? []) {
    const days = session.day_codes ?? session.days ?? [];
    add(Array.isArray(days) ? days : [], session.start ?? session.start_time, session.end ?? session.end_time);
  }
  for (const [day, key] of dayKeys) {
    add([day], data[`${key}_open`] ?? data[`${key}_start`], data[`${key}_close`] ?? data[`${key}_end`]);
  }
  add([1, 2, 3, 4, 5], data.weekday_open ?? data.weekday_start, data.weekday_close ?? data.weekday_end);
  add([0, 6], data.weekend_open ?? data.weekend_start, data.weekend_close ?? data.weekend_end);
  addTimes([1, 2, 3, 4, 5], data.weekday?.all);
  for (const [day, key] of dayKeys.slice(0, 7)) addTimes([day], data.weekday?.[key]);
  addTimes([6], data.saturday?.all ?? data.saturday);
  addTimes([0], data.sunday?.all ?? data.sunday);
  addTimes([7], data.holiday?.all ?? data.holiday);
  addTimes([0, 6], data.weekend?.all ?? data.weekend);

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }));
}

function adultPrice(source) {
  const active = (source.programs ?? []).find(
    (program) => program.program_type === "free_swim" && program.is_active !== false,
  );
  const data = active?.price_data;
  if (!data || typeof data !== "object") return null;
  const daily = (data.price_items ?? []).find((item) => item.type === "daily");
  const candidates = [
    daily?.prices?.adult,
    daily?.prices?.성인,
    daily?.prices?.일반,
    data.adult,
    data.성인,
    data.price,
    data.amount,
    data.day_pass,
  ];
  for (const candidate of candidates) {
    const amount = typeof candidate === "string" ? Number(candidate.replace(/[^\d]/g, "")) : candidate;
    if (Number.isFinite(amount) && amount >= 500) return amount;
  }
  return null;
}

function priceTiers(source) {
  const active = (source.programs ?? []).find(
    (program) => program.program_type === "free_swim" && program.is_active !== false,
  );
  const daily = (active?.price_data?.price_items ?? []).find((item) => item.type === "daily");
  const labels = { adult: "성인", youth: "청소년", teen: "청소년", child: "어린이", senior: "경로", 일반: "일반", 성인: "성인" };
  return Object.entries(daily?.prices ?? {})
    .map(([key, rawAmount]) => {
      const amount = typeof rawAmount === "string" ? Number(rawAmount.replace(/[^\d]/g, "")) : rawAmount;
      return { label: labels[key] ?? key, amount };
    })
    .filter(({ amount }) => Number.isFinite(amount) && amount >= 500);
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
  ) score += 80;
  if (distance <= 40) score += 100;
  else if (distance <= 120) score += 60;
  else if (distance <= 300) score += 20;
  return { score, distance };
}

const pools = JSON.parse(await readFile(poolsPath, "utf8"));
const sources = await fetchSources();
const changes = [];

for (const pool of pools) {
  const needsSchedule = !Array.isArray(pool.free_swim) || pool.free_swim.length === 0;
  const needsPrice = pool.price_free_swim == null;
  if (!needsSchedule && !needsPrice) continue;
  const ranked = sources
    .map((source) => ({ source, ...scoreMatch(pool, source) }))
    .filter(({ source, score, distance }) =>
      score >= 120 &&
      distance <= 2_000 &&
      (toFreeSwim(source).length || adultPrice(source) != null),
    )
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
    if (!Array.isArray(pool.prices) || pool.prices.length === 0) {
      pool.prices = priceTiers(source);
      fields.push("prices");
    }
    fields.push("price_free_swim");
  }
  if (!pool.homepage_url && source.website && !String(source.website).includes("helloswim.kr")) {
    pool.homepage_url = source.website;
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
    fields,
    checkedAt: "2026-08-03",
    sourceUpdatedAt: source.latest_confirmed_at ?? source.updated_at ?? null,
    sourcePage: source.pageUrl,
    primarySource: source.website ?? null,
  });
}

console.log(JSON.stringify({
  localPools: pools.length,
  sourcePools: sources.length,
  activeFreeSwimSources: sources.filter((source) => (source.programs ?? []).some((p) => p.program_type === "free_swim" && p.is_active !== false)).length,
  matchedChanges: changes.length,
  schedulesFilled: changes.filter(({ fields }) => fields.includes("free_swim")).length,
  pricesFilled: changes.filter(({ fields }) => fields.includes("price_free_swim")).length,
  sample: changes.slice(0, 30),
}, null, 2));

if (write) {
  await writeFile(poolsPath, `${JSON.stringify(pools, null, 2)}\n`);
  await mkdir(path.dirname(auditPath), { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await readFile(auditPath, "utf8"));
  } catch {
    // 첫 감사 기록 생성.
  }
  const byPool = new Map(existing.map((entry) => [entry.poolId, entry]));
  for (const change of changes) byPool.set(change.poolId, change);
  await writeFile(auditPath, `${JSON.stringify([...byPool.values()], null, 2)}\n`);
  console.error(`${changes.length}개 시설을 반영했습니다.`);
}
