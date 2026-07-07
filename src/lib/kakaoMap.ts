// Kakao Maps JS SDK를 한 번만 로드한다. autoload=false → maps.load 콜백에서 초기화.
// 도메인은 Kakao 콘솔 [플랫폼 → Web]에 등록돼 있어야 지도가 뜬다.
// SDK는 공식 타입이 없어 통째로 any로 둔다 (한 곳에서만 허용).
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Kakao = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    kakao: Kakao;
  }
}

const KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

let promise: Promise<Kakao> | null = null;

export function loadKakao(): Promise<Kakao> {
  if (!KEY) return Promise.reject(new Error("VITE_KAKAO_JS_KEY 없음"));
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => reject(new Error("Kakao SDK 로드 실패"));
    document.head.appendChild(s);
  });
  return promise;
}
