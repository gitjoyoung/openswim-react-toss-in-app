import { openURL } from "@apps-in-toss/web-framework";

// 지도 앱 딥링크는 API 키·콘솔 등록이 필요 없다. 앱 미설치 시 웹으로 폴백.
const APP = "openswim"; // 네이버 딥링크는 appname(우리 appName) 필수

async function open(scheme: string, web: string) {
  try {
    await openURL(scheme); // 토스 앱: 지도 앱 설치돼 있으면 앱으로 전환
    return;
  } catch {
    /* 앱 미설치/미지원 → 아래로 */
  }
  try {
    await openURL(web); // 토스 앱: 브릿지로 웹 열기
    return;
  } catch {
    /* 일반 브라우저(dev 등) → 아래로 */
  }
  window.open(web, "_blank", "noopener"); // 브라우저 폴백
}

export function openKakaoMap(name: string, lat: number, lng: number) {
  const n = encodeURIComponent(name);
  return open(
    `kakaomap://route?ep=${lat},${lng}&by=FOOT`,
    `https://map.kakao.com/link/to/${n},${lat},${lng}`,
  );
}

export function openNaverMap(name: string, lat: number, lng: number) {
  const n = encodeURIComponent(name);
  return open(
    `nmap://route/walk?dlat=${lat}&dlng=${lng}&dname=${n}&appname=${APP}`,
    `https://map.naver.com/p/search/${n}`,
  );
}
