import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const POOLS_PATH = path.join(ROOT, "src/data/pools.json");
const AUDIT_PATH = path.join(ROOT, "docs/data/pool-source-audit.json");

const session = (start, end) => ({ start, end });
const weekdays = (sessions) => [1, 2, 3, 4, 5].map((day) => ({ day, sessions }));

const overrides = [
  {
    id: "3b967e53-1254-470d-ac2b-1098592b75c4",
    fields: {
      free_swim: [
        ...weekdays([session("06:00", "07:50"), session("12:00", "13:50"), session("21:00", "22:50")]),
        { day: 6, sessions: [session("06:00", "18:50")] },
      ],
      phone: "02-1600-1980",
      homepage_url: "https://atbabgujung.modoo.at/",
    },
    sourceUpdatedAt: "2025-02-12",
    sources: ["https://seoulswimmer.tistory.com/39"],
  },
  {
    id: "41621d35-b3b9-4064-b1dc-20ab0cb29aa0",
    fields: {
      free_swim: [
        { day: 0, sessions: [session("06:30", "18:30")] },
        { day: 6, sessions: [session("06:30", "18:30")] },
        { day: 7, sessions: [session("06:30", "18:30")] },
      ],
      homepage_url: "https://hd-artscenter.co.kr/",
    },
    sourceUpdatedAt: "2026-02-01",
    sources: [
      "https://hd-artscenter.co.kr/lecture/detail.do?SVC_ID=detail&lectureDetailSeq=0000023176&lectureMasterSeq=0000000061&mid=0302",
    ],
  },
  {
    id: "71fa281c-9c97-4926-a04b-a7f56ad108cf",
    fields: {
      free_swim: [
        ...weekdays([session("08:00", "08:50"), session("12:00", "12:50"), session("21:50", "22:40")]),
        {
          day: 6,
          sessions: [
            session("06:00", "09:50"),
            session("12:00", "13:30"),
            session("14:00", "15:30"),
            session("16:00", "17:30"),
          ],
        },
      ],
      price_free_swim: 10000,
      prices: [
        { label: "성인", amount: 10000 },
        { label: "회원 성인", amount: 9000 },
        { label: "어린이", amount: 8000 },
      ],
      phone: "0507-1345-2748",
      homepage_url: "http://pf.kakao.com/_xcRiAK",
    },
    sourceUpdatedAt: "2024-05-07",
    sources: ["https://swimmingis.com/detail/162"],
  },
  {
    id: "3edd2d58-893f-4682-bb18-0ec98725340c",
    fields: {
      free_swim: [
        ...weekdays([session("06:00", "20:00")]),
        { day: 6, sessions: [session("06:00", "20:00")] },
      ],
      phone: "061-830-6731",
      homepage_url: "https://www.goheung.go.kr/culture/",
    },
    sourceUpdatedAt: "2025-03-12",
    sources: ["https://swimmingis.com/detail/486"],
  },
  {
    id: "fdeb6902-2adf-4db0-bb2d-ccd285777280",
    fields: {
      free_swim: [
        ...weekdays([session("06:00", "12:00"), session("13:00", "20:00")]),
        { day: 6, sessions: [session("06:00", "17:00")] },
      ],
    },
    sourceUpdatedAt: "2025-08-02",
    sources: ["https://hello109.com/jeonju-deokjin-swimming-pool-class-schedule-operating-guide/"],
  },
  {
    id: "0c22c1ef-04cf-4432-9ddc-4b50c50f7666",
    fields: {
      price_free_swim: 4000,
      prices: [
        { label: "성인", amount: 4000 },
        { label: "청소년", amount: 3000 },
        { label: "어린이", amount: 2000 },
      ],
    },
    sourceUpdatedAt: "2026-01-01",
    sources: [
      "https://oneul-swim.vercel.app/pool/kspo-0A9567CC19ADC46E52A0353FBB50E335",
      "https://onyourtop.tistory.com/617",
    ],
  },
];

const pools = JSON.parse(await readFile(POOLS_PATH, "utf8"));
let audit = [];
try {
  audit = JSON.parse(await readFile(AUDIT_PATH, "utf8"));
} catch {
  // 첫 감사 기록 생성.
}
const auditByPool = new Map(audit.map((entry) => [entry.poolId, entry]));

for (const override of overrides) {
  const pool = pools.find(({ id }) => id === override.id);
  if (!pool) throw new Error(`수영장 ID를 찾을 수 없습니다: ${override.id}`);
  Object.assign(pool, override.fields);

  const existing = auditByPool.get(pool.id) ?? {};
  auditByPool.set(pool.id, {
    ...existing,
    poolId: pool.id,
    poolName: pool.name,
    fields: [...new Set([...(existing.fields ?? []), ...Object.keys(override.fields)])],
    checkedAt: new Date().toISOString().slice(0, 10),
    sourceUpdatedAt: override.sourceUpdatedAt,
    sources: [...new Set([...(existing.sources ?? []), ...override.sources])],
  });
}

await writeFile(POOLS_PATH, JSON.stringify(pools), "utf8");
await mkdir(path.dirname(AUDIT_PATH), { recursive: true });
await writeFile(AUDIT_PATH, `${JSON.stringify([...auditByPool.values()], null, 2)}\n`, "utf8");
console.log(`${overrides.length}개 시설의 검색 검증 결과를 반영했습니다.`);
