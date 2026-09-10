import type { Pool } from "../pool";
import { DEFAULT_POOL_NOTICE_TEXTS, type PoolNoticeTexts } from "../appText";
import { fillTemplate } from "./richText";
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
  // 자유수영 시간을 언제 확인했는지 그대로 보여준다.
  // 한 문장으로 읽히게 쪼갠다: linkLabel(링크가 되는 부분) + trailing(나머지 문장).
  // 문장은 DB(app_texts)에서 온 통 텍스트다. 링크는 텍스트 안에 마크다운으로 들어 있다.
  // caution 은 별도 줄로 렌더한다. 확인 사실과 주의 안내가 한 문단으로 붙어 읽히면 안 된다.
  sourceNotice: { text: string; caution: string | null } | null;
};

// 공식 운영 주체가 직접 올리는 페이지에서, 신뢰도 높게 확인한 값만 경고 없이 보여준다.
const HOMEPAGE_SOURCE_TYPES = new Set(["official_gov", "official_pub", "operator_site"]);
const CONFIDENT_LEVELS = new Set(["medium", "high"]);

// 근거 표시 문구를 만든다. 문장은 DB(app_texts)에서 온 통 텍스트고, 링크는 그 안에 마크다운으로 적혀 있다.
// 앱이 정하는 것은 두 가지뿐이다. 어떤 문장을 쓸지(확인 날짜 유무), 주의 문장을 붙일지.
// 내부 출처 분류명(블로그, 정보 사이트 등)은 노출하지 않는다. 데이터 신뢰만 떨어뜨린다.
function buildSourceNotice(
  pool: Pool,
  texts: PoolNoticeTexts,
): PoolDetailModel["sourceNotice"] {
  const type = pool.free_swim_source_type ?? null;
  const confidence = pool.free_swim_confidence ?? null;
  if (!type && !confidence) return null;

  const verifiedAt = pool.free_swim_verified_at ?? null;
  const confirmed =
    verifiedAt !== null &&
    type !== null &&
    confidence !== null &&
    HOMEPAGE_SOURCE_TYPES.has(type) &&
    CONFIDENT_LEVELS.has(confidence);

  // 확인한 날짜가 없으면 확인했다고 쓸 수 없다. 근거 링크도 걸지 않는다.
  const template = verifiedAt ? texts.verified : texts.unverified;

  return {
    text: fillTemplate(template, {
      date: verifiedAt,
      source: verifiedAt ? (pool.free_swim_source ?? null) : null,
    }),
    caution: confirmed ? null : texts.caution,
  };
}

export function buildPoolDetailModel(
  pool: Pool,
  texts: PoolNoticeTexts = DEFAULT_POOL_NOTICE_TEXTS,
): PoolDetailModel {
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
    sourceNotice: buildSourceNotice(pool, texts),
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
