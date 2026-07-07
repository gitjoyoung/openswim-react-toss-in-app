import { adaptive } from "@toss/tds-colors";

// 디자인 토큰 — 색은 TDS adaptive(다크모드 자동)에 의미 이름을 매핑하고,
// 브랜드 블루만 우리가 소유한다. 컴포넌트는 원시 hex/grey 대신 이 토큰만 참조한다.
// (로고·지도 마커와 동일한 토스 블루 계통)

export const brand = {
  main: "#3182f6",
  tint: "#3182f622", // 13% alpha — 칩/뱃지 배경
};

export const color = {
  bg: adaptive.background,
  divider: adaptive.grey100,
  fill: adaptive.grey100, // 칩·필 배경
  textStrong: adaptive.grey800,
  text: adaptive.grey700,
  textSub: adaptive.grey600,
  textMuted: adaptive.grey500,
  textFaint: adaptive.grey400,
  icon: adaptive.grey300,
} as const;

// 오늘 운영/휴무 상태 색 (지도 마커와 동일 계통)
export const status = { open: brand.main, closed: "#f04452", unknown: "#f5a623" } as const;

// 요일 색 규칙 — 평일=검정, 토요일=파랑, 일요일=빨강 (달력 컬러). 홈 리스트·지도 카드 공통 단일 규칙.
export const dayColor = { weekday: color.textStrong, sat: brand.main, sun: status.closed } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

// 레이아웃
export const APP_MAX_WIDTH = 480;
// 플로팅 탭바가 차지하는 세로 공간(바 높이 + 하단 띄움 여백, 세이프에어리어 제외).
// Screen 하단 여백을 이만큼 줘서 리스트 콘텐츠가 플로팅 바에 안 가리게.
export const TAB_BAR_RESERVE = 88;
