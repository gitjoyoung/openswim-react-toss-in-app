// 수영용품 추천(토스쇼핑 쉐어링크) 목록.
//
// 운영자가 하는 일은 public.gear_items 에 url 한 줄 넣는 것뿐이다.
// 상품명·이미지는 `pnpm gear:sync` 가 각 링크의 og 태그를 읽어 DB 에 채운다.
// (웹뷰에서 toss.im 을 직접 fetch 하면 CORS 로 막힌다 — 실측 확인. 이미지 URL 은 <img> 로 잘 로드된다.)
//
// 조회 방식은 pools 와 같다. Neon Data API 를 우선 쓰고, 통신 장애 때만 번들 JSON 으로 폴백한다.
// 가격은 담지 않는다. 판매가·쿠폰가는 수시로 바뀌는데 앱은 배포 주기가 있어서
// 하드코딩하면 반드시 틀린 값을 표시하게 되고, 표시·광고의 공정화에 관한 법률 위반 소지가 있다.
export type GearItem = {
  id: string;
  name: string;
  note: string | null;
  image: string;
  url: string;
};

const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, "");
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.replace(/\/$/, "");

let gearPromise: Promise<GearItem[]> | null = null;

type GearRow = {
  id?: unknown;
  product_id?: unknown;
  name?: unknown;
  note?: unknown;
  image_url?: unknown;
  url?: unknown;
};

// 화면에 내보낼 수 있는 행만 남긴다.
// 링크만 넣고 아직 sync 를 안 돌린 행은 name/image_url 이 비어 있는데, 그대로 그리면 빈 카드가 된다.
// 쉐어링크 형식이 아닌 url 은 수익이 집계되지 않으므로 노출하지 않는다.
export function toGearItems(payload: unknown): GearItem[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((row: GearRow) => {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const image = typeof row?.image_url === "string" ? row.image_url : "";
    const url = typeof row?.url === "string" ? row.url : "";
    if (!name || !image) return [];
    if (!url.startsWith("https://toss.im/_m/")) return [];
    const id =
      typeof row?.product_id === "string" && row.product_id
        ? row.product_id
        : typeof row?.id === "string"
          ? row.id
          : url;
    return [{ id, name, note: typeof row?.note === "string" ? row.note : null, image, url }];
  });
}

async function fetchRemoteGear(): Promise<GearItem[]> {
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

  const requestUrl = new URL(`${neonDataApiUrl}/gear_items`);
  requestUrl.searchParams.set("select", "id,product_id,name,note,image_url,url");
  requestUrl.searchParams.set("is_active", "is.true");
  requestUrl.searchParams.set("name", "not.is.null");
  requestUrl.searchParams.set("image_url", "not.is.null");
  // 최신 등록순. 새로 넣은 상품이 앞에 온다.
  // sort_order 는 같은 시각에 여러 건을 넣었을 때 순서를 고정하는 용도로만 남긴다.
  requestUrl.searchParams.set("order", "created_at.desc,sort_order.asc");

  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Neon gear_items request failed: ${response.status}`);
  return toGearItems(await response.json());
}

async function fetchBundledGear(): Promise<GearItem[]> {
  const mod = await import("./data/gear.generated.json");
  return (mod.default as { items: GearItem[] }).items;
}

async function loadGear(): Promise<GearItem[]> {
  try {
    return await fetchRemoteGear();
  } catch (error) {
    console.warn("Neon gear_items request failed; using bundled fallback data.", error);
    return fetchBundledGear();
  }
}

export function fetchGear(): Promise<GearItem[]> {
  gearPromise ??= loadGear();
  return gearPromise;
}

// 공정거래위원회 추천·보증 심사지침에 따른 경제적 이해관계 표시.
// 쉐어링크 운영정책의 권장 문구를 그대로 쓴다.
// 정책이 "상품 소개 문단 바로 위에 표시"를 적절한 예로, "본문 끝에만 표시"를 부족할 수 있는 예로 들어서
// 화면에서도 목록 위에 둔다.
export const GEAR_DISCLOSURE =
  "이 콘텐츠는 토스쇼핑 쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를 지급받습니다.";
