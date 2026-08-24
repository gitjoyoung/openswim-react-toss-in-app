// free_swim 의 문자열 요일("평일"·"토요일"·"주말"…)을 숫자 요일로 정규화한다.
// 앱(src/lib/pools.ts normalizeDays)이 런타임에 하던 변환을 데이터에 미리 반영해
// 저장된 값 자체를 정규 형태로 맞춘다.
//
// 사용법: node scripts/normalize-free-swim-days.mjs [--write]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const POOLS_PATH = path.join(process.cwd(), "src/data/pools.json");
const WRITE = process.argv.includes("--write");
const HOLIDAY_DAY = 7;

// src/lib/pools.ts 의 normalizeDays 와 동일한 매핑을 유지한다.
function normalizeDays(day) {
  if (Number.isInteger(day) && day >= 0 && day <= HOLIDAY_DAY) return [day];
  if (day === "평일") return [1, 2, 3, 4, 5];
  if (day === "토요일") return [6];
  if (day === "일요일") return [0];
  if (day === "주말") return [0, 6];
  if (day === "공휴일") return [HOLIDAY_DAY];
  return [];
}

const timeRe = /^\d{2}:\d{2}$/;
const pools = JSON.parse(await readFile(POOLS_PATH, "utf8"));

const stats = { poolsTouched: 0, rowsExpanded: 0, rowsDropped: 0, sessionsDropped: 0 };
const dropped = [];

for (const pool of pools) {
  if (!Array.isArray(pool.free_swim) || pool.free_swim.length === 0) continue;

  const byDay = new Map();
  let changed = false;

  for (const row of pool.free_swim) {
    const days = normalizeDays(row.day);
    if (!days.length) {
      stats.rowsDropped += 1;
      dropped.push({ pool: pool.name, day: row.day });
      changed = true;
      continue;
    }
    if (typeof row.day !== "number" || days.length > 1) changed = true;
    if (days.length > 1 || typeof row.day === "string") stats.rowsExpanded += 1;

    for (const day of days) {
      const sessions = byDay.get(day) ?? new Map();
      for (const s of row.sessions ?? []) {
        const start = String(s.start ?? "");
        const end = String(s.end ?? "");
        if (!timeRe.test(start) || !timeRe.test(end) || start >= end) {
          stats.sessionsDropped += 1;
          changed = true;
          continue;
        }
        sessions.set(`${start}-${end}`, { start, end });
      }
      byDay.set(day, sessions);
    }
  }

  const normalized = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }));

  // 세션이 하나도 없는 날은 "휴무" 의미로 유지한다 (공휴일 휴무 표현에 쓰인다).
  if (changed || JSON.stringify(normalized) !== JSON.stringify(pool.free_swim)) {
    pool.free_swim = normalized;
    stats.poolsTouched += 1;
  }
}

console.log(JSON.stringify({ stats, droppedSample: dropped.slice(0, 20) }, null, 2));

if (WRITE) {
  await writeFile(POOLS_PATH, `${JSON.stringify(pools, null, 2)}\n`, "utf8");
  console.error(`${stats.poolsTouched}개 시설의 free_swim 요일을 정규화했습니다.`);
}
