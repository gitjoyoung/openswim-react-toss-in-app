// 앱 화면에 나가는 공통 문구. 배포 없이 문구만 고치려고 DB(public.app_texts)에서 읽는다.
//
// 값(확인 날짜·근거 링크·경고 여부)은 pools 의 free_swim_* 컬럼이 정하고, 여기서는 문장 표현만 온다.
// 조회 방식은 pools·gear_items 와 같다. Neon Data API 를 쓰고, 실패하면 아래 기본 문구로 폴백한다.
// 문구가 안 나오는 것보다 예전 문구가 나오는 편이 낫다.
export type PoolNoticeTexts = {
  // {date} 는 확인 날짜로 치환된다.
  verified: string;
  // verified 문장 안에서 근거 페이지 링크가 걸리는 부분.
  linkLabel: string;
  unverified: string;
  caution: string;
};

export const DEFAULT_POOL_NOTICE_TEXTS: PoolNoticeTexts = {
  verified: "해당 수영장 정보를 {date} 확인하였습니다.",
  linkLabel: "해당 수영장 정보",
  unverified: "시간표 정보를 확인하지 못했습니다.",
  caution: "방문 전 확인이 필요합니다.",
};

const TEXT_KEYS: Record<keyof PoolNoticeTexts, string> = {
  verified: "pool_notice_verified",
  linkLabel: "pool_notice_link_label",
  unverified: "pool_notice_unverified",
  caution: "pool_notice_caution",
};

const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, "");
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");

let textsPromise: Promise<PoolNoticeTexts> | null = null;

// 키가 빠졌거나 값이 비었으면 그 항목만 기본 문구를 쓴다. 한 행이 비어도 화면 전체가 깨지지 않게 한다.
export function toPoolNoticeTexts(payload: unknown): PoolNoticeTexts {
  if (!Array.isArray(payload)) return DEFAULT_POOL_NOTICE_TEXTS;

  const byKey = new Map<string, string>();
  for (const row of payload) {
    if (typeof row !== "object" || row === null) continue;
    const { key, value } = row as { key?: unknown; value?: unknown };
    if (typeof key === "string" && typeof value === "string" && value.trim()) {
      byKey.set(key, value);
    }
  }

  return {
    verified: byKey.get(TEXT_KEYS.verified) ?? DEFAULT_POOL_NOTICE_TEXTS.verified,
    linkLabel: byKey.get(TEXT_KEYS.linkLabel) ?? DEFAULT_POOL_NOTICE_TEXTS.linkLabel,
    unverified: byKey.get(TEXT_KEYS.unverified) ?? DEFAULT_POOL_NOTICE_TEXTS.unverified,
    caution: byKey.get(TEXT_KEYS.caution) ?? DEFAULT_POOL_NOTICE_TEXTS.caution,
  };
}

async function fetchRemoteTexts(): Promise<PoolNoticeTexts> {
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

  const requestUrl = new URL(`${neonDataApiUrl}/app_texts`);
  requestUrl.searchParams.set("select", "key,value");
  requestUrl.searchParams.set("key", `like.pool_notice_%`);

  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Neon app_texts request failed: ${response.status}`);
  return toPoolNoticeTexts(await response.json());
}

export function fetchPoolNoticeTexts(): Promise<PoolNoticeTexts> {
  textsPromise ??= fetchRemoteTexts().catch((error) => {
    console.warn("Neon app_texts request failed; using bundled default texts.", error);
    return DEFAULT_POOL_NOTICE_TEXTS;
  });
  return textsPromise;
}
