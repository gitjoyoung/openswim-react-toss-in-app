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
};

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
      facility.lanes != null ? `레인 ${facility.lanes}` : null,
      facility.lane_length_m != null ? `${facility.lane_length_m}M` : null,
      depth ? `수심 ${depth}` : null,
    ].filter((pill): pill is string => pill !== null),
    contact: { phone: pool.phone, homepageUrl: pool.homepage_url },
    images: images(safePool),
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
  const facility: Record<string, number> = {};
  for (const key of ["lanes", "lane_length_m", "depth_min", "depth_max"]) {
    if (typeof value[key] === "number") facility[key] = value[key];
  }
  return facility;
}

function validImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((image): image is string => typeof image === "string")
    : [];
}
