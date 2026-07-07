import type { Pool } from "../supabase";

// 기본 우선 지역 — 검색·위치 없을 때 홈 목록/지도가 먼저 보여줄 곳.
export const DEFAULT_GU = "금천구";
export const DEFAULT_GU_CENTER = { lat: 37.4569, lng: 126.8955 }; // 금천구청 근처

// 지역(위치) 기반 검색: 토큰이 (구·시도)에 다 있어야 매치. 이름·주소는 일부러 제외.
// → "용산"이 엉뚱한 지역 수영장 이름/주소에 걸리는 문제 방지. "부산 서구"처럼 시도+구도 OK.
// 특정 수영장은 이름 검색이 아니라 추천 목록(🏊)에서 바로 이동해 찾는다.
export function matchPool(p: Pool, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = `${p.gu} ${p.sido ?? ""}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

// 시도 축약: "부산광역시"→"부산", "강원특별자치도"→"강원", "경기도"→"경기".
export function shortSido(sido: string): string {
  return sido.replace(/(특별자치시|특별자치도|특별시|광역시|자치도|도|시)$/, "") || sido;
}

// (시도, 구) 고유 조합. 같은 "서구"라도 시도가 다르면 별개 항목.
export type Region = { sido: string; gu: string };
export function distinctRegions(pools: Pool[]): Region[] {
  const seen = new Set<string>();
  const out: Region[] = [];
  for (const p of pools) {
    const key = `${p.sido ?? ""}|${p.gu}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ sido: p.sido ?? "", gu: p.gu });
    }
  }
  return out;
}

// "부산 서구" 표기 (시도 축약 + 구). 지역 추천 라벨/검색어로 사용.
export function regionLabel(r: Region): string {
  return r.sido ? `${shortSido(r.sido)} ${r.gu}` : r.gu;
}

// 지역 정확 매칭 — 선택한 지역은 substring이 아니라 (시도·구) 완전일치로 필터.
// (그래야 "서구" 선택 시 "강서구"가 안 딸려옴)
export function inRegion(p: Pool, r: Region): boolean {
  return (p.sido ?? "") === r.sido && p.gu === r.gu;
}

// 검색어로 지역 추천 필터 (구·시도·"부산 서구" 어디든 매치).
export function matchRegion(r: Region, query: string): boolean {
  const s = query.trim();
  if (!s) return true;
  return r.gu.includes(s) || shortSido(r.sido).includes(s) || regionLabel(r).includes(s);
}
