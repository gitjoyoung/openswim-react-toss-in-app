export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Pool = {
  id: string;
  name: string;
  sido: string | null;
  gu: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  homepage_url: string | null;
  subway: string | null;
  price_free_swim: number | null;
  price_note: string | null;
  // 이용 대상 제한. access_label 은 배지용 짧은 문구, access_note 는 한 줄 설명.
  // 분류를 코드에 두지 않고 DB 자유 텍스트로 둔다. 새 유형이 생겨도 배포가 필요 없다.
  access_label?: string | null;
  access_note?: string | null;
  prices: Json;
  facilities: Json;
  free_swim: Json;
  images: string[];
  // 자유수영 데이터의 출처. 공식 페이지 확인 여부를 화면에서 구분하기 위해 쓴다.
  free_swim_source?: string | null;
  free_swim_source_type?: string | null;
  free_swim_verified_at?: string | null;
  free_swim_confidence?: string | null;
};

// VITE_* 값은 앱 번들에 포함되므로 공개 URL만 넣는다. DB 연결 문자열·관리 API 키는 넣지 않는다.
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.replace(
  /\/$/,
  "",
);
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");

// 앱이 실제로 쓰는 컬럼만 받는다. 새 컬럼을 화면에 쓰려면 여기에도 추가해야 한다.
const POOL_COLUMNS = [
  "id",
  "name",
  "sido",
  "gu",
  "address",
  "lat",
  "lng",
  "phone",
  "homepage_url",
  "subway",
  "price_free_swim",
  "price_note",
  "prices",
  "facilities",
  "free_swim",
  "images",
  "free_swim_source",
  "free_swim_source_type",
  "free_swim_verified_at",
  "free_swim_confidence",
  "access_label",
  "access_note",
].join(",");

let poolsPromise: Promise<Pool[]> | null = null;

export function isPoolArray(value: unknown): value is Pool[] {
  return (
    Array.isArray(value) &&
    value.every(
      (pool) =>
        typeof pool === "object" &&
        pool !== null &&
        typeof (pool as Pool).id === "string" &&
        typeof (pool as Pool).name === "string",
    )
  );
}

async function fetchRemotePools(): Promise<Pool[]> {
  if (!neonDataApiUrl || !neonAuthUrl) {
    throw new Error("Neon public API environment variables are not configured");
  }

  const tokenResponse = await fetch(`${neonAuthUrl}/token/anonymous`, {
    method: "GET",
    credentials: "omit",
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `Neon anonymous token request failed: ${tokenResponse.status}`,
    );
  }

  const tokenPayload: unknown = await tokenResponse.json();
  const token =
    typeof tokenPayload === "object" &&
    tokenPayload !== null &&
    typeof (tokenPayload as { token?: unknown }).token === "string"
      ? (tokenPayload as { token: string }).token
      : null;
  if (!token) throw new Error("Neon anonymous token response is invalid");

  const requestUrl = new URL(`${neonDataApiUrl}/pools`);
  // select=* 를 쓰지 않는다. PostgREST 가 * 를 펼칠 때 쓰는 스키마 캐시는
  // 컬럼을 추가한 뒤 notify pgrst 를 보내도 한동안 갱신되지 않는 경우가 있다.
  // (2026-09-10 access_label 추가 때 실측: 명시 컬럼 조회는 즉시 되는데 * 에는 몇 분 넘게 안 나왔다.)
  // 컬럼을 나열해 두면 그 문제를 안 겪고, 응답 크기도 필요한 만큼만 받는다.
  requestUrl.searchParams.set("select", POOL_COLUMNS);
  requestUrl.searchParams.set("order", "name.asc");

  const poolsResponse = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  if (!poolsResponse.ok) {
    throw new Error(`Neon pools request failed: ${poolsResponse.status}`);
  }

  const payload: unknown = await poolsResponse.json();
  if (!isPoolArray(payload)) throw new Error("Neon pools response is invalid");
  return payload;
}

// Neon 서버 데이터만 신뢰한다. 번들 JSON 폴백은 폐기했다(2026-09-10).
//
// 폐기 이유: 폴백은 빌드 시점에 고정되므로 시간이 지나면 반드시 낡는다.
// 그런데 사용자에게는 최신 데이터와 똑같아 보이기 때문에, 휴장한 수영장을
// "오늘 열림"으로 보여주는 종류의 오답을 조용히 낸다.
// 답을 틀리느니 못 불러왔다고 밝히고 다시 시도하게 하는 편이 낫다.
export function fetchPools(): Promise<Pool[]> {
  // 실패한 promise 를 캐시에 남기면 "다시 시도" 가 같은 거부 결과를 다시 돌려준다.
  // 폴백이 있을 땐 이 경로가 사실상 안 쓰여 드러나지 않았다.
  poolsPromise ??= fetchRemotePools().catch((error: unknown) => {
    poolsPromise = null;
    throw error;
  });
  return poolsPromise;
}
