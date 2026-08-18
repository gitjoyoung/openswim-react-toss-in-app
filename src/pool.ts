export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
  prices: Json;
  facilities: Json;
  free_swim: Json;
  images: string[];
};

// VITE_* 값은 앱 번들에 포함되므로 공개 URL만 넣는다. DB 연결 문자열·관리 API 키는 넣지 않는다.
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, "");
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");

let poolsPromise: Promise<Pool[]> | null = null;

function isPoolArray(value: unknown): value is Pool[] {
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

  const requestUrl = new URL(`${neonDataApiUrl}/pools`);
  requestUrl.searchParams.set("select", "*");
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

async function fetchBundledPools(): Promise<Pool[]> {
  const mod = await import("./data/pools.json");
  return mod.default as Pool[];
}

async function loadPools(): Promise<Pool[]> {
  try {
    return await fetchRemotePools();
  } catch (error) {
    console.warn("Neon pools request failed; using bundled fallback data.", error);
    return fetchBundledPools();
  }
}

// 원격 Neon 데이터를 우선 사용하고, 통신 장애 때만 번들 JSON으로 폴백한다.
export function fetchPools(): Promise<Pool[]> {
  poolsPromise ??= loadPools();
  return poolsPromise;
}
