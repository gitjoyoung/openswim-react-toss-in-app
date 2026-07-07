// 즐겨찾기 = 로컬 저장(로그인 없음). 기기 간 동기화 필요해지면 서버로 옮긴다.
const KEY = "fav_pool_ids";

export function loadFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveFavs(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // 제한된 스토리지(프라이빗 모드/쿼터 초과 등) — 저장 실패는 조용히 무시
  }
}
