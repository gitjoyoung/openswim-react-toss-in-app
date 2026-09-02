import type { Pool } from "../pool";
import {
  daysLabel,
  depthText,
  facilities,
  groupSchedule,
  images,
  prices,
  type Session,
} from "./pools";

export type PoolDetailModel = {
  schedule: { days: number[]; label: string; sessions: Session[] }[];
  priceRows: { label: string; amount: number | null }[];
  facilityPills: string[];
  contact: { phone: string | null; homepageUrl: string | null };
  images: string[];
  // 자유수영 시간의 근거를 그대로 보여준다. 공식 확인된 값과 미확인 값을 사용자가 구분할 수 있게 한다.
  sourceNotice: { label: string; sourceUrl: string | null; needsCheck: boolean } | null;
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  official_gov: "지자체 공식 페이지",
  official_pub: "공공기관 공식 페이지",
  operator_site: "운영사 홈페이지",
  aggregator: "수영장 정보 사이트",
  blog: "블로그 등 비공식 출처",
  unknown: "출처 미확인",
};

// 근거 표시 문구를 만든다. 확인이 안 된 값은 단정하지 않고 문의 안내를 붙인다.
function buildSourceNotice(pool: Pool): PoolDetailModel["sourceNotice"] {
  const type = pool.free_swim_source_type ?? null;
  const confidence = pool.free_swim_confidence ?? null;
  if (!type && !confidence) return null;

  const needsCheck = confidence === "needs_check" || type === "unknown" || type === null;
  const typeLabel = SOURCE_TYPE_LABEL[type ?? "unknown"] ?? SOURCE_TYPE_LABEL.unknown;
  const verified = pool.free_swim_verified_at ? `${pool.free_swim_verified_at} 확인` : null;
  const label = needsCheck
    ? `${typeLabel} · 이용 전 시설 문의 필요`
    : [typeLabel, verified].filter(Boolean).join(" · ");

  return { label, sourceUrl: pool.free_swim_source ?? null, needsCheck };
}

export function buildPoolDetailModel(pool: Pool): PoolDetailModel {
  const safePool = {
    ...pool,
    free_swim: validSchedule(pool.free_swim),
    prices: validPrices(pool.prices),
    facilities: validFacilities(pool.facilities),
    images: validImages(pool.images),
  };
  const facility = facilities(safePool);
  const depth = depthText(facility);
  const priceRows = prices(safePool);

  return {
    schedule: groupSchedule(safePool).map((group) => ({
      days: group.days,
      label: daysLabel(group.days),
      sessions: group.sessions,
    })),
    priceRows: priceRows.length
      ? priceRows
      : [{ label: "자유수영", amount: pool.price_free_swim }],
    facilityPills: [
      ...(facility.notes ?? []),
      facility.lanes != null ? `레인 ${facility.lanes}` : null,
      facility.lane_length_m != null ? `${facility.lane_length_m}M` : null,
      depth ? `수심 ${depth}` : null,
    ].filter((pill): pill is string => pill !== null),
    contact: { phone: pool.phone, homepageUrl: pool.homepage_url },
    images: images(safePool),
    sourceNotice: buildSourceNotice(pool),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validSchedule(value: unknown): Pool["free_swim"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      (typeof entry.day !== "number" && typeof entry.day !== "string")
    )
      return [];
    const sessions = Array.isArray(entry.sessions)
      ? entry.sessions.flatMap((session) =>
          isRecord(session) &&
          typeof session.start === "string" &&
          typeof session.end === "string"
            ? [{ start: session.start, end: session.end }]
            : [],
        )
      : [];
    return [{ day: entry.day, sessions }];
  });
}

function validPrices(value: unknown): Pool["prices"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) =>
    isRecord(row) &&
    typeof row.label === "string" &&
    typeof row.amount === "number"
      ? [{ label: row.label, amount: row.amount }]
      : [],
  );
}

function validFacilities(value: unknown): Pool["facilities"] {
  if (!isRecord(value)) return {};
  const facility: Record<string, unknown> = {};
  for (const key of ["lanes", "lane_length_m", "depth_min", "depth_max"]) {
    if (typeof value[key] === "number") facility[key] = value[key];
  }
  if (Array.isArray(value.notes)) {
    const notes = value.notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0);
    if (notes.length) facility.notes = notes;
  }
  return facility as Pool["facilities"];
}

function validImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((image): image is string => typeof image === "string")
    : [];
}
