import type { Pool } from "../pool";
import { isHoliday } from "./holidays";

export type Session = { start: string; end: string };
export type DaySchedule = { day: number; sessions: Session[] };
export type Facilities = {
  lanes?: number;
  lane_length_m?: number;
  depth_min?: number;
  depth_max?: number;
};

// 수심 표시 문자열 (min==max면 "1.2m", 다르면 "1.2~1.4m")
export function depthText(f: Facilities): string | null {
  if (f.depth_min == null) return null;
  return f.depth_min === f.depth_max
    ? `${f.depth_min}m`
    : `${f.depth_min}~${f.depth_max}m`;
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
// free_swim에서 공휴일 스케줄을 나타내는 특수 day 값. (세션 있으면 공휴일 운영, 빈 배열이면 공휴일 휴무)
export const HOLIDAY_DAY = 7;

// 요일 짧은 이름. 7 = 공휴일.
function dayShort(day: number): string {
  return day === HOLIDAY_DAY ? "공휴일" : DAY_NAMES[day];
}

// 오늘 '운영 여부' 판정에 쓸 요일. 공휴일이면 7(공휴일 스케줄 참조), 아니면 실제 요일.
export function todayDayIndex(): number {
  return isHoliday() ? HOLIDAY_DAY : new Date().getDay();
}

// freeSwim 결과 캐시. 목록 한 화면(수백 행)에서 행마다 여러 번 불리는데 매번 파싱하면 낭비다.
// pools는 fetch 후 객체가 그대로 유지되므로 객체 자체를 키로 쓴다. (데이터 갱신 시 새 객체 → 자동 무효화)
const freeSwimCache = new WeakMap<Pool, DaySchedule[]>();

// free_swim/facilities 는 DB에서 jsonb(Json) 라 좁혀서 꺼낸다.
// 실데이터가 뒤죽박죽이라 여기서 요일 오름차순 + 세션 시작시각순으로 정렬해 항상 정돈된 값을 준다.
export function freeSwim(p: Pool): DaySchedule[] {
  const cached = freeSwimCache.get(p);
  if (cached) return cached;
  const parsed = parseFreeSwim(p);
  freeSwimCache.set(p, parsed);
  return parsed;
}

function parseFreeSwim(p: Pool): DaySchedule[] {
  const raw = Array.isArray(p.free_swim)
    ? (p.free_swim as unknown as { day: number | string; sessions?: Session[] }[])
    : [];
  const byDay = new Map<number, Map<string, Session>>();

  for (const entry of raw) {
    for (const day of normalizeDays(entry.day)) {
      const sessions = byDay.get(day) ?? new Map<string, Session>();
      for (const session of entry.sessions ?? []) {
        sessions.set(`${session.start}-${session.end}`, session);
      }
      byDay.set(day, sessions);
    }
  }

  return [...byDay.entries()]
    .map(([day, sessions]) => ({
      day,
      sessions: [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start)),
    }))
    .sort((a, b) => a.day - b.day);
}

function normalizeDays(day: number | string): number[] {
  if (Number.isInteger(day) && Number(day) >= 0 && Number(day) <= HOLIDAY_DAY) return [Number(day)];
  if (day === "평일") return [1, 2, 3, 4, 5];
  if (day === "토요일") return [6];
  if (day === "일요일") return [0];
  if (day === "주말") return [0, 6];
  if (day === "공휴일") return [HOLIDAY_DAY];
  return [];
}

export function facilities(p: Pool): Facilities {
  return (p.facilities as unknown as Facilities) ?? {};
}

// 같은 시간표를 가진 요일을 하나로 묶는다 (월~금이 동일하면 5줄 → 1줄).
export type ScheduleGroup = { days: number[]; sessions: Session[] };
export function groupSchedule(p: Pool): ScheduleGroup[] {
  const bySig = new Map<string, ScheduleGroup>();
  for (const d of freeSwim(p)) {
    const sig = d.sessions.map((s) => `${s.start}-${s.end}`).join(",");
    const g = bySig.get(sig);
    if (g) g.days.push(d.day);
    else bySig.set(sig, { days: [d.day], sessions: d.sessions });
  }
  // 표시 순서: 평일 → 토요일 → 일요일 → 공휴일 (월요일 시작, 일요일·공휴일을 맨 뒤로).
  const ord = (d: number) => (d === 0 ? 7 : d === HOLIDAY_DAY ? 8 : d);
  return [...bySig.values()].sort(
    (a, b) => Math.min(...a.days.map(ord)) - Math.min(...b.days.map(ord)),
  );
}

// 요일 묶음 라벨: 평일(월~금)·토요일·일요일을 우선 자연스러운 말로, 그 외는 "월·수·금"/"월~목".
export function daysLabel(days: number[]): string {
  const s = [...days].sort((a, b) => a - b);
  const key = s.join(",");
  if (key === "1,2,3,4,5") return "평일";
  if (key === "6") return "토요일";
  if (key === "0") return "일요일";
  if (key === "7") return "공휴일";
  const consecutive = s.every((d, i) => i === 0 || d === s[i - 1] + 1);
  if (s.length >= 3 && consecutive) return `${dayShort(s[0])}~${dayShort(s[s.length - 1])}`;
  return s.map(dayShort).join("·");
}

// 홈 리스트용 운영요일 요약(필터 무관, 항상 동일). 평일(특수요일)·토요일·일요일 버킷.
export function operatingDaysLabel(p: Pool): string {
  const days = freeSwim(p)
    .filter((d) => d.sessions.length > 0) // 빈 배열(공휴일 휴무 등)은 '운영'에서 제외
    .map((d) => d.day);
  if (!days.length) return "시설 문의";
  const parts: string[] = [];
  const weekdays = days.filter((d) => d >= 1 && d <= 5);
  if (weekdays.length) parts.push(daysLabel(weekdays)); // "평일" 또는 "월·수·금"
  if (days.includes(6)) parts.push("토요일");
  if (days.includes(0)) parts.push("일요일");
  if (days.includes(HOLIDAY_DAY)) parts.push("공휴일");
  return parts.join(" · ") + " 운영";
}

export function images(p: Pool): string[] {
  return p.images ?? [];
}

// 요금 티어: "일반"(비할인) + 할인(회원/지역주민 등). label 자유 텍스트.
export type PriceTier = { label: string; amount: number };

export function prices(p: Pool): PriceTier[] {
  return Array.isArray(p.prices) ? (p.prices as unknown as PriceTier[]) : [];
}

export function wonText(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

// 요금 정보가 아예 없을 때는 "시설 문의"로 안내 (상세·마커 카드 공통).
export function formatPrice(p: Pool): string {
  return p.price_free_swim != null ? wonText(p.price_free_swim) : "시설 문의";
}

// 오늘(공휴일이면 공휴일 스케줄 기준) 자유수영 세션이 있으면 true. today 주입 가능(테스트).
export function isOpenToday(p: Pool, today = todayDayIndex()): boolean {
  return freeSwim(p).some((d) => d.day === today && d.sessions.length > 0);
}

// 특정 요일의 시간대 요약. 5부까지 있어도 "외 N회"로 압축. 없으면 "".
export function dayScheduleText(p: Pool, day: number): string {
  const sessions = freeSwim(p).find((x) => x.day === day)?.sessions ?? [];
  if (!sessions.length) return "";
  const first = `${sessions[0].start}~${sessions[0].end}`;
  return sessions.length > 1 ? `${first} 외 ${sessions.length - 1}회` : first;
}

// 리스트 행 상태 문구 + 색조. text 는 필터 맥락에 맞춘 문구(오늘 운영/오늘 휴무/토요일 …).
// unknown = 자유수영 시간표를 아직 확보 못한 곳(노랑). "닫힘"이 아니라 "정보 없음".
export type RowStatus = { text: string; tone: "open" | "closed" | "muted" | "unknown" };

// 정확한 자유수영 시간표가 있는가. 없으면 앱은 '닫힘'이 아니라 '정보 없음'으로 다룬다.
export function hasSchedule(p: Pool): boolean {
  return freeSwim(p).length > 0;
}

// 마커/상태 3분류. 공휴일이면 day=7 스케줄로, 아니면 오늘 요일로 판정.
// 공휴일에 day=7 데이터가 없으면 '정보 없음'(노랑), 빈 배열이면 휴무, 세션 있으면 운영.
export function markerState(p: Pool): "open" | "closed" | "unknown" {
  if (isHoliday()) {
    const h = freeSwim(p).find((d) => d.day === HOLIDAY_DAY);
    if (!h) return "unknown";
    return h.sessions.length ? "open" : "closed";
  }
  if (!hasSchedule(p)) return "unknown";
  return isOpenToday(p) ? "open" : "closed";
}

// 오늘 기준 상태 (기본값·즐겨찾기용). 공휴일이면 문구도 공휴일 맥락으로.
export function todayRowStatus(p: Pool): RowStatus {
  const st = markerState(p);
  const hol = isHoliday();
  if (st === "unknown")
    return { text: hol ? "공휴일 운영 정보 없음" : "자유수영 정보 없음", tone: "unknown" };
  if (st === "closed") return { text: hol ? "오늘 휴무 (공휴일)" : "오늘 휴무", tone: "closed" };
  const t = dayScheduleText(p, todayDayIndex());
  return { text: t ? `오늘 운영 · ${t}` : "오늘 운영", tone: "open" };
}

// 특정 요일(0=일 … 6=토)에 세션이 있으면 true.
export function openOnDay(p: Pool, day: number): boolean {
  return freeSwim(p).some((d) => d.day === day);
}

// 평일(월~금) 중 하루라도 운영하면 true.
export function openWeekday(p: Pool): boolean {
  return freeSwim(p).some((d) => d.day >= 1 && d.day <= 5);
}

// 주말(토·일) 중 하루라도 운영하면 true.
export function openWeekend(p: Pool): boolean {
  return freeSwim(p).some((d) => d.day === 0 || d.day === 6);
}
