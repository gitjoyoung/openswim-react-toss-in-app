import { getCurrentLocation } from "@apps-in-toss/web-framework";

export type LatLng = { lat: number; lng: number };

// 두 좌표 간 거리(km). 넓은 범위여도 haversine 근사로 정렬엔 충분.
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// 사용자가 명시적으로 위치 권한을 거부한 경우 (브라우저 폴백으로 넘기지 않음).
class LocationDeniedError extends Error {}

// 브라우저(개발)용 폴백 — 네이티브 브릿지가 없을 때만.
function browserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

// 토스 앱: 권한 확인 → 미허용이면 권한 다이얼로그부터 (한 번 거부해도 설정으로 유도).
// 브라우저(개발): getPermission이 브릿지 없어 throw → navigator.geolocation 폴백.
export async function getMyLocation(): Promise<LatLng> {
  try {
    let status = await getCurrentLocation.getPermission();
    if (status !== "allowed") {
      // notDetermined → OS 권한창, denied → '설정에서 허용' 안내 다이얼로그
      status = await getCurrentLocation.openPermissionDialog();
    }
    if (status !== "allowed") throw new LocationDeniedError();
    // Accuracy.Balanced = 3 (enum은 런타임 export가 없어 숫자로 전달)
    const loc = await getCurrentLocation({ accuracy: 3 } as Parameters<typeof getCurrentLocation>[0]);
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch (e) {
    if (e instanceof LocationDeniedError) throw e; // 사용자가 거부 → 폴백 안 함
    return browserLocation(); // 브릿지 없음(브라우저) → 폴백
  }
}

// 조용한 조회 — 권한창을 절대 띄우지 않고 "이미 허용된" 경우에만 위치 반환. 없으면 null.
// 홈·지도 진입 시 권한 있으면 자동으로 내 위치 기준, 없으면 기본 지역(금천구)으로 폴백.
export async function getMyLocationSilent(): Promise<LatLng | null> {
  try {
    // 토스 앱: 권한이 이미 allowed일 때만 조회 (openPermissionDialog 호출 안 함)
    const status = await getCurrentLocation.getPermission();
    if (status !== "allowed") return null;
    const loc = await getCurrentLocation({ accuracy: 3 } as Parameters<typeof getCurrentLocation>[0]);
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    // 브라우저: geolocation 권한이 이미 granted인 경우에만 (권한 API 없으면 스킵).
    try {
      if (!navigator.permissions) return null;
      const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (perm.state !== "granted") return null;
      return await browserLocation();
    } catch {
      return null;
    }
  }
}
