import { useRef, useState } from "react";
import { Top, Button, Text } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import { wonText } from "../lib/pools";
import { buildPoolDetailModel } from "../lib/poolDetail";
import { usePoolNoticeTexts } from "../hooks/usePoolNoticeTexts";
import { usePoolDetailActions } from "../hooks/usePoolDetailActions";
import PoolMap from "../components/PoolMap";
import BannerAd from "../components/BannerAd";
import CopyAddressButton from "../components/CopyAddressButton";
import RichText from "../components/RichText";
import GearSection from "../components/GearSection";
import { Section, Divider, Pill, Caption } from "../design/primitives";
import FavStar from "../components/FavStar";
import freeImg from "../assets/free.webp"; // 사진 없는 곳 기본 이미지
import { brand, color, radius, space, status } from "../design/tokens";

type Props = {
  pool: Pool;
  isFav: boolean;
  onToggleFav: () => void;
};

export default function PoolDetail({
  pool,
  isFav,
  onToggleFav,
}: Props) {
  // 시간표 아래 문구는 DB(app_texts)에서 온다. 받아오기 전에는 번들 기본 문구를 쓴다.
  const noticeTexts = usePoolNoticeTexts();
  const model = buildPoolDetailModel(pool, noticeTexts);
  const actions = usePoolDetailActions(pool);
  // 복사용 주소. 주소가 없으면 복사할 게 없으니 버튼 자체를 숨긴다.
  const addressToCopy = pool.address?.trim() || null;

  return (
    <div
      style={{
        // 마지막 섹션이 모바일 화면 끝과 홈 인디케이터에 붙지 않도록 여유를 둔다.
        paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
      }}
    >
      <Hero
        images={model.images.length ? model.images : [freeImg]}
        name={pool.name}
        isFav={isFav}
        onToggleFav={onToggleFav}
      />

      <Top
        lowerGap={0} // 주소 밑 하단 패딩 제거 (다음 섹션이 자체 상단 여백을 가짐)
        title={<Top.TitleParagraph size={22}>{pool.name}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {pool.gu}
            {pool.address ? `  ${pool.address}` : ""}
            {addressToCopy && <CopyAddressButton text={addressToCopy} />}
          </Top.SubtitleParagraph>
        }
      />

      {pool.lat != null && pool.lng != null && (
        <>
          <Section title="위치">
            <PoolMap lat={pool.lat} lng={pool.lng} />
            <div
              style={{ display: "flex", gap: space.sm, marginTop: space.md }}
            >
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <Button
                  size="medium"
                  display="full"
                  onClick={actions.openKakaoRoute}
                  // 카카오 상징색(옐로우) + 검정 텍스트
                  style={
                    {
                      "--button-background-color": "#FEE500",
                      "--button-color": "#191919",
                    } as React.CSSProperties
                  }
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <PinIcon />
                    카카오맵 길찾기
                  </span>
                </Button>
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <Button
                  size="medium"
                  display="full"
                  onClick={actions.openNaverRoute}
                  // 네이버 상징색(그린) + 흰 텍스트
                  style={
                    {
                      "--button-background-color": "#03C75A",
                      "--button-color": "#ffffff",
                    } as React.CSSProperties
                  }
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
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

      {(model.contact.phone || model.contact.homepageUrl) && (
        <>
          <Section title="정보">
            {model.contact.phone && (
              <a
                href={`tel:${model.contact.phone}`}
                style={{
                  ...linkStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ flexShrink: 0 }}>📞</span>
                <Text typography="t6" fontWeight="semibold" color={brand.main}>
                  {model.contact.phone}
                </Text>
              </a>
            )}
            {model.contact.homepageUrl && (
              <a
                href={model.contact.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={actions.openHomepage}
                style={{
                  ...linkStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
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
                  {model.contact.homepageUrl}
                </span>
              </a>
            )}
          </Section>
          <Divider />
        </>
      )}

      <Section title="시간표">
        {model.schedule.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {model.schedule.map((g, gi) => (
              <div
                key={gi}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: space.md,
                }}
              >
                <DayBadge days={g.days} label={g.label} />
                {/* 고정폭 + 숫자 등폭(tabular-nums)이라 흔들림 없이 정렬. Z플립 폭에서도 한 줄 2개. */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
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

        {/* 문구는 DB(app_texts)에 통으로 들어 있다. 링크도 그 문장 안의 마크다운으로 처리한다.
            확인 사실과 방문 전 확인 안내는 서로 다른 줄로 나간다. */}
        {model.sourceNotice && (
          <div style={{ marginTop: space.md }}>
            <Caption>
              <RichText text={model.sourceNotice.text} />
            </Caption>
            {model.sourceNotice.caution && (
              <div style={{ marginTop: 2 }}>
                <Caption>
                  <RichText text={model.sourceNotice.caution} />
                </Caption>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 배너는 화면당 하나만(토스 애즈 SSP: 동일 화면 동일 포맷 2개 이상 금지).
          주소 복사 버튼·길찾기 버튼 바로 아래에 두면 오클릭이 날 수 있어
          누를 것이 없는 시간표 아래(요금 위)에 둔다.
          separated 로 위아래 구분선을 둘러 자기 영역을 갖게 한다 —
          안 그러면 바로 아래 요금 카드 안에 든 것처럼 보인다. */}
      <BannerAd slot="detail" separated />

      <Section title="요금">
        <PriceTable rows={model.priceRows} />
        {pool.price_note && (
          <div style={{ marginTop: space.md }}>
            <Caption>{pool.price_note}</Caption>
          </div>
        )}

        {/* 정규권·강습 등은 우리가 안 다루므로, 홈페이지 없을 때만 문의 안내. (홈페이지 링크는 최하단으로) */}
        {!model.contact.homepageUrl && (
          <div style={{ marginTop: space.md }}>
            <Caption>정규권과 강습 요금은 수영장에 직접 문의해 주세요.</Caption>
          </div>
        )}
      </Section>

      <Divider />

      <Section title="시설">
        {model.facilityPills.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm }}>
            {model.facilityPills.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        ) : (
          <Caption>시설 정보 없음</Caption>
        )}
      </Section>

      <Divider />

      <GearSection />
    </div>
  );
}

function PriceTable({
  rows,
}: {
  rows: { label: string; amount: number | null }[];
}) {
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
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}
function NavIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
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
}: {
  images: string[];
  name: string;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const multi = images.length > 1;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: HERO_HEIGHT,
        background: color.fill,
      }}
    >
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

// 요일 뱃지 — 넉넉한 최소폭으로 통일. 색은 달력 관례를 따른다.
function DayBadge({ days, label }: { days: number[]; label: string }) {
  const only = days.length === 1 ? days[0] : null;
  const textColor =
    only === 0 ? status.closed : only === 6 ? status.open : color.textStrong;
  return (
    <span
      style={{
        flexShrink: 0,
        minWidth: 92,
        height: 32,
        borderRadius: radius.sm,
        background: color.fill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        typography="t7"
        fontWeight="bold"
        color={textColor}
        style={{ whiteSpace: "nowrap" }}
      >
        {label}
      </Text>
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 0",
  textDecoration: "none",
};


