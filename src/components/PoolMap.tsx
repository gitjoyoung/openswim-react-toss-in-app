import { useRef } from "react";
import { usePoolMap } from "../hooks/usePoolMap";
import { radius, color } from "../design/tokens";

// 상세 페이지용 실제 카카오 지도 미리보기 (마커 1개). 로드 실패 시 안내로 대체.
export default function PoolMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { error } = usePoolMap({ containerRef: ref, preview: { center: { lat, lng }, level: 4 } });

  if (error) {
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
