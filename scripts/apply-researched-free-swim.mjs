import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const POOLS_PATH = path.join(ROOT, "src/data/pools.json");
const AUDIT_PATH = path.join(ROOT, "docs/data/pool-source-audit.json");

const batchPaths = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const WRITE = process.argv.includes("--write");

if (!batchPaths.length) {
  throw new Error("사용법: node scripts/apply-researched-free-swim.mjs <batch.json> [<batch2.json> ...] [--write]");
}

const timeRe = /^\d{2}:\d{2}$/;

function validateFreeSwim(entry) {
  if (!Array.isArray(entry.free_swim)) return null;
  const byDay = new Map();
  for (const row of entry.free_swim) {
    const day = Number(row.day);
    if (!Number.isInteger(day) || day < 0 || day > 7) continue;
    const sessions = [];
    for (const s of row.sessions ?? []) {
      const start = String(s.start ?? "");
      const end = String(s.end ?? "");
      if (!timeRe.test(start) || !timeRe.test(end)) continue;
      if (start >= end) continue;
      sessions.push({ start, end });
    }
    if (!sessions.length) continue;
    const existing = byDay.get(day) ?? new Map();
    for (const s of sessions) existing.set(`${s.start}-${s.end}`, s);
    byDay.set(day, existing);
  }
  if (!byDay.size) return null;
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }));
}

function validatePrices(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({ label: String(row.label ?? "").trim(), amount: Number(row.amount) }))
    .filter((row) => row.label && Number.isFinite(row.amount) && row.amount > 0);
}

const pools = JSON.parse(await readFile(POOLS_PATH, "utf8"));
const poolsById = new Map(pools.map((pool) => [pool.id, pool]));

let audit = [];
try {
  audit = JSON.parse(await readFile(AUDIT_PATH, "utf8"));
} catch {
  // 첫 감사 기록 생성.
}
const auditByPool = new Map(audit.map((entry) => [entry.poolId, entry]));

const stats = { totalEntries: 0, notFound: 0, alreadyHadSchedule: 0, applied: 0, skippedInvalid: 0 };
const appliedList = [];

for (const batchPath of batchPaths) {
  const raw = JSON.parse(await readFile(batchPath, "utf8"));
  for (const entry of raw) {
    stats.totalEntries += 1;
    const pool = poolsById.get(entry.id);
    if (!pool) {
      stats.notFound += 1;
      console.error(`ID를 찾을 수 없음: ${entry.id}`);
      continue;
    }
    if (Array.isArray(pool.free_swim) && pool.free_swim.length > 0) {
      stats.alreadyHadSchedule += 1;
      continue;
    }
    const freeSwim = validateFreeSwim(entry);
    if (!freeSwim) {
      stats.skippedInvalid += 1;
      console.error(`유효한 free_swim 없음, 건너뜀: ${entry.id} (${pool.name})`);
      continue;
    }

    const fields = ["free_swim"];
    pool.free_swim = freeSwim;

    if (pool.price_free_swim == null && Number.isFinite(entry.price_free_swim) && entry.price_free_swim > 0) {
      pool.price_free_swim = Math.round(entry.price_free_swim);
      fields.push("price_free_swim");
    }
    const prices = validatePrices(entry.prices);
    if ((!Array.isArray(pool.prices) || pool.prices.length === 0) && prices.length) {
      pool.prices = prices;
      fields.push("prices");
    }
    if (!pool.phone && entry.phone) {
      pool.phone = String(entry.phone);
      fields.push("phone");
    }
    if (!pool.homepage_url && entry.homepage_url) {
      pool.homepage_url = String(entry.homepage_url);
      fields.push("homepage_url");
    }

    stats.applied += 1;
    appliedList.push({ id: entry.id, name: pool.name, fields, confidence: entry.confidence ?? null });

    const existingAudit = auditByPool.get(pool.id) ?? {};
    auditByPool.set(pool.id, {
      ...existingAudit,
      poolId: pool.id,
      poolName: pool.name,
      fields: [...new Set([...(existingAudit.fields ?? []), ...fields])],
      checkedAt: new Date().toISOString().slice(0, 10),
      sourceUpdatedAt: existingAudit.sourceUpdatedAt ?? null,
      sourcePage: entry.source_url ?? existingAudit.sourcePage ?? null,
      primarySource: entry.source_url ?? existingAudit.primarySource ?? null,
      confidence: entry.confidence ?? existingAudit.confidence ?? null,
      note: "AI 조사원 웹 검색 기반 자유수영 시간표 보강",
    });
  }
}

console.log(JSON.stringify({ stats, applied: appliedList }, null, 2));

if (WRITE) {
  await writeFile(POOLS_PATH, `${JSON.stringify(pools, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(AUDIT_PATH), { recursive: true });
  await writeFile(AUDIT_PATH, `${JSON.stringify([...auditByPool.values()], null, 2)}\n`, "utf8");
  console.error(`${stats.applied}개 시설에 조사 결과를 반영했습니다.`);
}
