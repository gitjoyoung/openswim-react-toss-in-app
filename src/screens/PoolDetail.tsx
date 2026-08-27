import { useRef, useState } from "react";
import { Top, Button, Text } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import {
  facilities,
  depthText,
  images,
  prices,
  wonText,
  groupSchedule,
  daysLabel,
} from "../lib/pools";
import { openKakaoMap, openNaverMap, openExternal } from "../lib/mapLinks";
import PoolMap from "../components/PoolMap";
import BannerAd from "../components/BannerAd";
import { Section, Divider, Pill, Caption } from "../design/primitives";
import FavStar from "../components/FavStar";
import freeImg from "../assets/free.webp"; // 사진 없는 곳 기본 이미지
import { brand, color, radius, space, status } from "../design/tokens";

type Props = {
  pool: Pool;
  isFav: boolean;
  onToggleFav: () => void;
  onClose: () => void;
};

export default function PoolDetail({ pool, isFav, onToggleFav, onClose }: Props) {
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

  return (
    <div
      style={{
        // 마지막 섹션이 모바일 화면 끝과 홈 인디케이터에 붙지 않도록 여유를 둔다.
        paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
      }}
    >
      <Hero images={pics.length ? pics : [freeImg]} name={pool.name} isFav={isFav} onToggleFav={onToggleFav} onClose={onClose} />

      <Top
        lowerGap={0} // 주소 밑 하단 패딩 제거 (다음 섹션이 자체 상단 여백을 가짐)
        title={<Top.TitleParagraph size={22}>{pool.name}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {pool.gu}
            {pool.address ? `  ${pool.address}` : ""}
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
                onClick={(e) => {
                  e.preventDefault();
                  openExternal(pool.homepage_url!);
                }}
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

      <Section title="요금">
        <PriceTable
          rows={
            priceTiers.length
              ? priceTiers
              : [{ label: "자유수영", amount: pool.price_free_swim }]
          }
        />
        {pool.price_note && <Caption>{pool.price_note}</Caption>}

        {/* 정규권·강습 등은 우리가 안 다루므로, 홈페이지 없을 때만 문의 안내. (홈페이지 링크는 최하단으로) */}
        {!pool.homepage_url && (
          <div style={{ marginTop: space.md }}>
            <Caption>정규권과 강습 요금은 수영장에 직접 문의해 주세요.</Caption>
          </div>
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

      {/* 배너는 콘텐츠 중간이 아니라 화면 하단에만 (앱인토스 인앱 광고 규칙). */}
      <BannerAd slot="detail" />
    </div>
  );
}

function PriceTable({ rows }: { rows: { label: string; amount: number | null }[] }) {
  return (
    <div
      style={{
        border: `1px solid ${color.divider}`,
        borderRadius: radius.sm,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: space.sm,
          padding: "9px 12px",
          background: color.fill,
          fontSize: 12,
          fontWeight: 700,
          color: color.textSub,
        }}
      >
        <span>구분</span>
        <span style={{ textAlign: "right" }}>요금</span>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: space.sm,
            padding: "10px 12px",
            fontSize: 14,
            borderTop: `1px solid ${color.divider}`,
          }}
        >
          <span style={{ color: color.textSub }}>{row.label}</span>
          <span
            style={{
              textAlign: "right",
              color: color.textStrong,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {row.amount != null ? wonText(row.amount) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

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
  onToggleFav,
  onClose,
}: {
  images: string[];
  name: string;
  isFav: boolean;
  onToggleFav: () => void;
  onClose: () => void;
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

      {/* 목록으로 돌아가는 버튼. 시스템 뒤로가기(App의 backEvent)로도 닫히지만,
          화면 안에 나가는 길이 보이는 편이 자연스러워 좌측 상단에 둔다. */}
      <button onClick={onClose} aria-label="뒤로" style={backBtnStyle}>
        <BackIcon />
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

// 뒤로가기 버튼 — 이미지 위에 얹히므로 반투명 배경으로 대비 확보. 탭 타겟 44.
const backBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(8px + env(safe-area-inset-top))",
  left: 8,
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  lineHeight: 1,
};

// 뒤로가기 화살표. currentColor를 따라가므로 버튼 색만 바꾸면 된다.
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 19L8 12L15 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
