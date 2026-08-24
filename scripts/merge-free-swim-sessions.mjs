// 같은 요일 안에서 겹치거나 맞닿은 자유수영 세션을 하나로 병합한다.
//   06:00-12:50 + 09:00-12:50  ->  06:00-12:50  (포함)
//   13:00-13:50 + 13:30-15:00  ->  13:00-15:00  (겹침)
//   06:00-07:00 + 07:00-08:50  ->  06:00-08:50  (맞닿음, 연속 이용 가능)
// 상세 화면에서 겹친 시간대가 그대로 노출되면 사용자가 혼란스럽기 때문에 정규화한다.
//
// 사용법: node scripts/merge-free-swim-sessions.mjs [--write]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const POOLS_PATH = path.join(process.cwd(), "src/data/pools.json");
const WRITE = process.argv.includes("--write");

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function mergeSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    // 맞닿은 경우(이전 종료 == 다음 시작)도 연속 이용이 가능하므로 하나로 본다.
    if (last && toMinutes(s.start) <= toMinutes(last.end)) {
      if (toMinutes(s.end) > toMinutes(last.end)) last.end = s.end;
    } else {
      merged.push({ start: s.start, end: s.end });
    }
  }
  return merged;
}

const pools = JSON.parse(await readFile(POOLS_PATH, "utf8"));
const stats = { poolsTouched: 0, daysTouched: 0, sessionsBefore: 0, sessionsAfter: 0 };
const samples = [];

for (const pool of pools) {
  if (!Array.isArray(pool.free_swim) || pool.free_swim.length === 0) continue;
  let touched = false;

  for (const row of pool.free_swim) {
    const before = row.sessions ?? [];
    stats.sessionsBefore += before.length;
    const after = mergeSessions(before);
    stats.sessionsAfter += after.length;

    if (after.length !== before.length) {
      stats.daysTouched += 1;
      touched = true;
      if (samples.length < 15) {
        samples.push({
          pool: pool.name,
          day: row.day,
          before: before.map((s) => `${s.start}-${s.end}`).join(", "),
          after: after.map((s) => `${s.start}-${s.end}`).join(", "),
        });
      }
    }
    row.sessions = after;
  }

  if (touched) stats.poolsTouched += 1;
}

console.log(JSON.stringify({ stats, samples }, null, 2));

if (WRITE) {
  await writeFile(POOLS_PATH, `${JSON.stringify(pools, null, 2)}\n`, "utf8");
  console.error(`${stats.poolsTouched}개 시설 / ${stats.daysTouched}개 요일의 세션을 병합했습니다.`);
}
