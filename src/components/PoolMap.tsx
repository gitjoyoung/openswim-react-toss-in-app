import { useEffect, useRef, useState } from "react";
import { loadKakao } from "../lib/kakaoMap";
import { radius, color } from "../design/tokens";

// 상세 페이지용 실제 카카오 지도 미리보기 (마커 1개). 로드 실패 시 안내로 대체.
export default function PoolMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        const pos = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(ref.current, { center: pos, level: 4 });
        new kakao.maps.Marker({ position: pos, map }); // 위치는 마커로 표시
        // 미리보기라 완전 고정 — 드래그·확대 막아 스크롤 시 지도가 잡혀 불편한 것 방지.
        map.setDraggable(false);
        map.setZoomable(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (failed) {
    return (
      <div
        style={{
          height: 180,
          borderRadius: radius.md,
          background: color.fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color.textMuted,
          fontSize: 14,
        }}
      >
        지도를 불러오지 못했어요
      </div>
    );
  }

  // pointer-events:none → 지도를 사진처럼 취급. 터치가 통과해 페이지가 그대로 스크롤됨.
  return (
    <div
      ref={ref}
      style={{ width: "100%", height: 180, borderRadius: radius.md, overflow: "hidden", pointerEvents: "none" }}
    />
  );
}
