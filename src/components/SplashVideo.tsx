import { useEffect, useRef, useState } from "react";

// 앱 로드 시 1회 재생하는 인트로 영상 오버레이.
// 모바일 WebView는 소리 자동재생을 막으므로 muted + playsInline 필수.
// 재생 끝/에러/타임아웃/건너뛰기 → 사라지고 앱으로 진입.
export default function SplashVideo({ src, onDone }: { src: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, 350); // 페이드아웃 후 제거
  };

  useEffect(() => {
    // 안전장치: 재생이 멈추거나 실패해도 최대 8초 뒤엔 반드시 진입(영상 길이보다 넉넉히)
    const t = setTimeout(finish, 8000);
    return () => clearTimeout(t);
    // 마운트 시 1회만 실행 (finish는 의도적으로 deps에서 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#3182f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.35s ease",
      }}
    >
      <video
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <button
        onClick={finish}
        style={{
          position: "absolute",
          top: "calc(12px + env(safe-area-inset-top))",
          right: 12,
          padding: "6px 14px",
          borderRadius: 999,
          border: "none",
          background: "rgba(255,255,255,0.22)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        건너뛰기
      </button>
    </div>
  );
}
