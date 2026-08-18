import type { ReactNode } from "react";
import { Text, Loader } from "@toss/tds-mobile";
import { brand, color, radius, space, APP_MAX_WIDTH, TAB_BAR_RESERVE } from "./tokens";

export { APP_MAX_WIDTH, TAB_BAR_RESERVE };

// 토스 스타일 재사용 프리미티브.
// 텍스트는 TDS Text의 typography 토큰(t5=17 / t6=15 / t7=13)만 쓴다 — 폰트 크기 하드코딩 금지(TDS 규칙).

// 웹에서도 모바일 폭으로 고정 — 480px 컬럼을 중앙 정렬. 탭바도 이 폭에 맞춘다(APP_MAX_WIDTH).
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: APP_MAX_WIDTH,
        margin: "0 auto",
        minHeight: "100dvh",
        background: color.bg,
        // 탭바 공간 + 하단 세이프에어리어(홈 인디케이터)만큼 비워 콘텐츠가 안 가리게
        paddingBottom: TAB_BAR_RESERVE,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ padding: `${space.xl}px ${space.xxl}px` }}>
      {title && (
        <Text
          typography="t7"
          fontWeight="bold"
          color={color.textMuted}
          display="block"
          style={{ marginBottom: space.md }}
        >
          {title}
        </Text>
      )}
      {children}
    </div>
  );
}

// 섹션 사이 두꺼운 회색 구분(토스 패턴).
export function Divider() {
  return <div style={{ height: 8, background: color.divider }} />;
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text typography="t7" color={color.textMuted} display="block">
      {children}
    </Text>
  );
}

// 라벨 ─ 값 한 줄 (상세 화면).
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  const isBrand = tone === "brand";
  return (
    <Text
      typography="t7"
      color={isBrand ? brand.main : color.textSub}
      display="inline"
      style={{
        padding: "6px 12px",
        borderRadius: radius.pill,
        background: isBrand ? brand.tint : color.fill,
      }}
    >
      {children}
    </Text>
  );
}

export function Chip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  accent?: string; // 지정 시 활성 배경/비활성 글자색으로 사용 (예: 토=파랑, 일=빨강)
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: "8px 16px",
        borderRadius: radius.pill,
        border: "none",
        cursor: "pointer",
        background: active ? (accent ?? brand.main) : color.fill,
      }}
    >
      <Text typography="t7" fontWeight={active ? "bold" : "medium"} color={active ? "#fff" : (accent ?? color.textSub)}>
        {children}
      </Text>
    </button>
  );
}

// 전체 로딩 — 토스 Loader를 화면 중앙에 배치. (초기 데이터/화면 로딩 공통)
export function Loading({ label }: { label?: string }) {
  return (
    <div style={{ minHeight: "70dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader size="medium" label={label} />
    </div>
  );
}

export function EmptyState({ emoji, text }: { emoji: string; text: ReactNode }) {
  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 32 }}>{emoji}</div>
      <Text typography="t6" color={color.textMuted} display="block" style={{ marginTop: space.sm, lineHeight: 1.5 }}>
        {text}
      </Text>
    </div>
  );
}
