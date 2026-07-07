import { useRef, useState } from "react";
import { Top, Button, Text } from "@toss/tds-mobile";
import type { Pool } from "../supabase";
import {
  facilities,
  depthText,
  formatPrice,
  images,
  prices,
  wonText,
  groupSchedule,
  daysLabel,
} from "../lib/pools";
import { openKakaoMap, openNaverMap } from "../lib/mapLinks";
import PoolMap from "../components/PoolMap";
import PoolReviews from "../components/PoolReviews";
import { Section, Divider, KeyValue, Pill, Caption } from "../design/primitives";
import FavStar from "../components/FavStar";
import freeImg from "../assets/free.webp"; // 사진 없는 곳 기본 이미지
import { brand, color, radius, space, status } from "../design/tokens";

type Props = {
  pool: Pool;
  isFav: boolean;
  onToggleFav: () => void;
  onBack: () => void;
};

export default function PoolDetail({ pool, isFav, onToggleFav, onBack }: Props) {
  const groups = groupSchedule(pool);
  const fac = facilities(pool);
  const pics = images(pool);
  const priceTiers = prices(pool);

  const depth = depthText(fac);
  const facPills = [
    fac.lanes != null ? `레인 ${fac.lanes}` : null,
    fac.lane_length_m != null ? `${fac.lane_length_m}M` : null,
    depth ? `수심 ${depth}` : null,
  ].filter(Boolean) as string[];

  const [showCalc, setShowCalc] = useState(false); // '기타 요금 계산법' 표 펼침

  return (
    <div>
      <Hero images={pics.length ? pics : [freeImg]} name={pool.name} isFav={isFav} onBack={onBack} onToggleFav={onToggleFav} />

      <Top
        lowerGap={0} // 주소 밑 하단 패딩 제거 (다음 섹션이 자체 상단 여백을 가짐)
        title={<Top.TitleParagraph size={22}>{pool.name}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {pool.gu}
            {pool.address ? ` · ${pool.address}` : ""}
          </Top.SubtitleParagraph>
        }
      />

      {pool.lat != null && pool.lng != null && (
        <>
          <Section title="위치">
            <PoolMap lat={pool.lat} lng={pool.lng} />
            <div style={{ display: "flex", gap: space.sm, marginTop: space.md }}>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <Button
                  size="medium"
                  display="full"
                  onClick={() => openKakaoMap(pool.name, pool.lat!, pool.lng!)}
                  // 카카오 상징색(옐로우) + 검정 텍스트
                  style={{ "--button-background-color": "#FEE500", "--button-color": "#191919" } as React.CSSProperties}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <PinIcon />
                    카카오맵 길찾기
                  </span>
                </Button>
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <Button
                  size="medium"
                  display="full"
                  onClick={() => openNaverMap(pool.name, pool.lat!, pool.lng!)}
                  // 네이버 상징색(그린) + 흰 텍스트
                  style={{ "--button-background-color": "#03C75A", "--button-color": "#ffffff" } as React.CSSProperties}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <NavIcon />
                    네이버 지도
                  </span>
                </Button>
              </div>
            </div>
          </Section>
          <Divider />
        </>
      )}

      {(pool.phone || pool.homepage_url) && (
        <>
          <Section title="정보">
            {pool.phone && (
              <a href={`tel:${pool.phone}`} style={{ ...linkStyle, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flexShrink: 0 }}>📞</span>
                <Text typography="t6" fontWeight="semibold" color={brand.main}>
                  {pool.phone}
                </Text>
              </a>
            )}
            {pool.homepage_url && (
              <a
                href={pool.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...linkStyle, display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ flexShrink: 0 }}>🔗</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 15,
                    fontWeight: 600,
                    color: brand.main,
                  }}
                >
                  {pool.homepage_url}
                </span>
              </a>
            )}
          </Section>
          <Divider />
        </>
      )}

      <Section title="시간표">
        {groups.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g, gi) => (
              <div key={gi} style={{ display: "flex", alignItems: "flex-start", gap: space.md }}>
                <DayBadge days={g.days} />
                {/* 고정폭 + 숫자 등폭(tabular-nums)이라 흔들림 없이 정렬. Z플립 폭에서도 한 줄 2개. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 0 }}>
                  {g.sessions.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        // 고정폭 대신 패딩 — 시간 문자열은 길이 동일 + tabular-nums(등폭)라 자동으로 같은 크기.
                        height: 32, // 요일 배지와 동일 높이
                        padding: "0 10px", // 텍스트 좌우 여백. 박스 ~108px → 최대폭(480)에서 3개/줄

                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: radius.sm,
                        background: color.fill,
                        color: color.textStrong,
                        fontSize: 14,
                        fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.start}~{s.end}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Caption>시설 문의</Caption>
        )}
      </Section>

      <Divider />

      <Section title="시설">
        {facPills.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm }}>
            {facPills.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        ) : (
          <Caption>시설 정보 없음</Caption>
        )}
      </Section>

      <Divider />

      <Section title="요금">
        {priceTiers.length ? (
          priceTiers.map((t) => <KeyValue key={t.label} label={t.label} value={wonText(t.amount)} />)
        ) : (
          <KeyValue label="자유수영" value={formatPrice(pool)} />
        )}
        {pool.price_note && <Caption>{pool.price_note}</Caption>}

        {/* 정규권·강습 등은 우리가 안 다루므로, 홈페이지 없을 때만 문의 안내. (홈페이지 링크는 최하단으로) */}
        {!pool.homepage_url && (
          <div style={{ marginTop: space.md }}>
            <Caption>정규권·강습 요금은 수영장에 직접 문의해 주세요.</Caption>
          </div>
        )}

        <div style={{ marginTop: space.md }}>
          <button
            type="button"
            onClick={() => setShowCalc((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              color: color.textSub,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            기타 요금 계산법
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: color.fill,
                color: color.textMuted,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ?
            </span>
          </button>
          {showCalc && (
            <>
          <div
            style={{
              marginTop: space.sm,
              border: `1px solid ${color.divider}`,
              borderRadius: radius.sm,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.2fr",
                gap: space.sm,
                padding: "8px 12px",
                background: color.fill,
                fontSize: 12,
                fontWeight: 700,
                color: color.textSub,
              }}
            >
              <span>구분</span>
              <span style={{ textAlign: "right" }}>성인 대비</span>
              <span style={{ textAlign: "right" }}>예상 금액</span>
            </div>
            {PRICE_RULES.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1.2fr",
                  gap: space.sm,
                  padding: "9px 12px",
                  fontSize: 13,
                  borderTop: `1px solid ${color.divider}`,
                }}
              >
                <span style={{ color: color.textSub }}>{r.label}</span>
                <span style={{ textAlign: "right", color: color.textMuted, fontVariantNumeric: "tabular-nums" }}>
                  {r.ratio}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: color.textStrong,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.example}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: space.sm }}>
            <Caption>
              청소년·어린이·경로는 감면, 주말·공휴일은 할증될 수 있어요. 정확한 금액은 시설·홈페이지에서 확인해 주세요.
            </Caption>
          </div>
            </>
          )}
        </div>
      </Section>

      <Divider />

      <PoolReviews poolId={pool.id} />
    </div>
  );
}

// 자유수영 요금은 시설이 조례로 정해 제각각(실측 청소년 50~100%)이라 파생 저장 대신 '대략 기준'만 안내.
// 성인 10,000원 예시로 감을 잡게 한다 (비율 계산이 바로 읽힘).
const PRICE_RULES = [
  { label: "성인 (평일)", ratio: "기준", example: "10,000원" },
  { label: "청소년", ratio: "약 70~75%", example: "약 7,500원" },
  { label: "어린이", ratio: "약 50%", example: "약 5,000원" },
  { label: "주말·공휴일", ratio: "최대 +30%", example: "약 13,000원" },
];

// 길찾기 버튼용 아이콘 (공식 로고 아님 — 브랜드색은 버튼 배경으로). currentColor 상속.
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}
function NavIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 11 21 3l-8 18-2.4-7.2L3 11z" />
    </svg>
  );
}

const HERO_HEIGHT = 300;

// 상세 최상단 히어로: 풀블리드 썸네일 슬라이드(1장~여러장, 스와이프) + 뒤로/저장 오버레이 + 페이지 닷.
function Hero({
  images,
  name,
  isFav,
  onBack,
  onToggleFav,
}: {
  images: string[];
  name: string;
  isFav: boolean;
  onBack: () => void;
  onToggleFav: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const multi = images.length > 1;

  return (
    <div style={{ position: "relative", width: "100%", height: HERO_HEIGHT, background: color.fill }}>
      {images.length ? (
        <div
          ref={trackRef}
          className="hero-track"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIdx(Math.round(el.scrollLeft / el.clientWidth));
          }}
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            overflowX: multi ? "auto" : "hidden",
            scrollSnapType: "x mandatory",
          }}
        >
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${name} 사진 ${i + 1}`}
              style={{
                flex: "0 0 100%",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                scrollSnapAlign: "start",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            background: brand.tint,
          }}
        >
          🏊
        </div>
      )}

      <button onClick={onBack} aria-label="뒤로" style={overlayBtn("left")}>
        ←
      </button>

      {/* 즐겨찾기 — 이미지 하단 오른쪽(엄지 닿기 쉬운 곳), 넉넉한 탭 타겟 */}
      <button
        onClick={onToggleFav}
        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.4)",
          cursor: "pointer",
          // 흰 배경 대신 반투명 + 블러(프로스티드 글래스)
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 4px 14px rgba(0,0,0,.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FavStar on={isFav} size={28} />
      </button>

      {multi && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function overlayBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(8px + env(safe-area-inset-top))",
    [side]: 8,
    width: 44, // 최소 탭 타겟 44
    height: 44,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    lineHeight: 1,
    backdropFilter: "blur(2px)",
  };
}

// 요일 뱃지 — 고정폭으로 통일. 색: 평일 검정 / 토요일 파랑 / 일요일 빨강(달력 관례).
function DayBadge({ days }: { days: number[] }) {
  const only = days.length === 1 ? days[0] : null;
  const textColor =
    only === 0 ? status.closed : only === 6 ? status.open : color.textStrong;
  return (
    <span
      style={{
        flexShrink: 0,
        width: 66,
        height: 32,
        borderRadius: radius.sm,
        background: color.fill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text typography="t7" fontWeight="bold" color={textColor} style={{ whiteSpace: "nowrap" }}>
        {daysLabel(days)}
      </Text>
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 0",
  textDecoration: "none",
};
