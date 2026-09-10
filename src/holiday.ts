// 관공서 공휴일을 DB(public.holidays)에서 읽는다.
//
// 조회 방식은 pools·gear_items·app_texts 와 같다. 실패하면 번들 표(src/lib/holidays.ts)를 그대로 쓴다.
// 공휴일 판정은 목록 렌더링 중 동기로 불리므로, 받아온 표는 모듈 캐시에 넣고 화면만 다시 그린다.
import { setHolidays } from "./lib/holidays";

const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, "");
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");

let holidaysPromise: Promise<boolean> | null = null;

// 행 하나가 깨져도 나머지는 살린다. 날짜 형식이 아닌 값은 버린다.
export function toHolidayMap(payload: unknown): Record<string, string> {
  if (!Array.isArray(payload)) return {};
  const map: Record<string, string> = {};
  for (const row of payload) {
    if (typeof row !== "object" || row === null) continue;
    const { date, name } = row as { date?: unknown; name?: unknown };
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    map[date] = typeof name === "string" && name.trim() ? name : "공휴일";
  }
  return map;
}

async function fetchRemoteHolidays(): Promise<Record<string, string>> {
  if (!neonDataApiUrl || !neonAuthUrl) {
    throw new Error("Neon public API environment variables are not configured");
  }

  const tokenResponse = await fetch(`${neonAuthUrl}/token/anonymous`, {
    method: "GET",
    credentials: "omit",
  });
  if (!tokenResponse.ok) {
    throw new Error(`Neon anonymous token request failed: ${tokenResponse.status}`);
  }
  const tokenPayload: unknown = await tokenResponse.json();
  const token =
    typeof tokenPayload === "object" &&
    tokenPayload !== null &&
    typeof (tokenPayload as { token?: unknown }).token === "string"
      ? (tokenPayload as { token: string }).token
      : null;
  if (!token) throw new Error("Neon anonymous token response is invalid");

  const requestUrl = new URL(`${neonDataApiUrl}/holidays`);
  requestUrl.searchParams.set("select", "date,name");
  // 지난 해 공휴일까지 받아올 이유가 없다. 올해 1월 1일부터.
  requestUrl.searchParams.set("date", `gte.${new Date().getFullYear()}-01-01`);

  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Neon holidays request failed: ${response.status}`);
  return toHolidayMap(await response.json());
}

// 성공적으로 갈아끼웠으면 true. 화면을 다시 그릴지 판단하는 데 쓴다.
export function loadHolidays(): Promise<boolean> {
  holidaysPromise ??= fetchRemoteHolidays()
    .then((map) => setHolidays(map))
    .catch((error) => {
      console.warn("Neon holidays request failed; using bundled holiday table.", error);
      return false;
    });
  return holidaysPromise;
}
