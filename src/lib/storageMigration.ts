import { Migration } from "@apps-in-toss/web-framework";
import { loadFavs, saveFavs } from "./favorites";

// 2026-08-25 부터 미니앱 Origin이 SDK 2.x 시절 Origin(openswim.apps.tossmini.com)으로 바뀐다.
// 그 전(3.x Origin)에 쌓인 localStorage는 다른 Origin이라 그냥은 안 보이므로,
// 브릿지가 넘겨주는 이전 Origin 덤프를 한 번 읽어 현재 Origin에 합친다.
const DONE_KEY = "originMigrated";

// 병합 후 즐겨찾기 목록을 돌려준다. 이미 했거나 브릿지가 없으면(브라우저 dev 등) null.
export async function migrateFromPreviousOrigin(): Promise<string[] | null> {
  try {
    if (localStorage.getItem(DONE_KEY)) return null;
  } catch {
    return null;
  }

  let prev: Record<string, string | null>;
  try {
    prev = (await Migration.getOriginStorage()).previous.localStorage;
  } catch {
    return null; // 브릿지 미지원 환경. 다음 실행에 다시 시도.
  }

  // 즐겨찾기: 양쪽 합집합 (순서는 기존 → 이전 순, 중복 제거)
  let prevFavs: string[] = [];
  try {
    const v = JSON.parse(prev["fav_pool_ids"] ?? "[]");
    prevFavs = Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    /* 깨진 값은 무시 */
  }
  const merged = [...new Set([...loadFavs(), ...prevFavs])];
  saveFavs(merged);

  // 인트로 시청 여부: 한쪽이라도 봤으면 다시 안 보여준다.
  try {
    if (prev["introSeen"]) localStorage.setItem("introSeen", "1");
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* 스토리지 차단 시 무시 */
  }
  return merged;
}
