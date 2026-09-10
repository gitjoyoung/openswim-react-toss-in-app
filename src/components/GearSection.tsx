import { Text } from "@toss/tds-mobile";
import { GEAR_DISCLOSURE } from "../gear";
import { useGear } from "../hooks/useGear";
import { openExternal } from "../lib/mapLinks";
import { Section, Caption } from "../design/primitives";
import { color, radius, space } from "../design/tokens";

// 쇼핑 — 토스쇼핑 쉐어링크로 이동하는 부가 구좌.
//
// 앱인토스 서비스 오픈 정책상 '외부 링크 이동'은 원칙적으로 제한되지만
// "각 제품을 소개·추천한 뒤 최저가 구매 플랫폼으로 이동"은 허용될 수 있는 경우로 명시돼 있다.
// 이 앱의 본질(수영장 자유수영 정보)은 앱 안에서 완결되어야 하므로
// 이 섹션은 상세 화면 맨 아래 부가 정보로만 둔다. 핵심 동선에 끼워 넣지 않는다.
//
// 광고(BannerAd)와 붙여 두지 않는다 — 토스 애즈 정책이
// '사용자 상호작용 요소와 인접한 광고 배치'를 오클릭 유도로 보기 때문이다.
//
// 레이아웃을 직접 짠 이유:
//   토스는 상품 카드 위젯을 제공하지 않는다(SDK·쉐어링크 문서 전수 확인).
//   TDS GridList 도 써 봤지만 이미지 슬롯이 28px 로 고정돼 있어서 — 아이콘용이다 —
//   정사각 상품 이미지를 넣으면 캡션 위로 넘쳐 겹쳤다(실측). 그래서 직접 만든다.
//   간격·모서리·색은 앱 토큰을 그대로 써서 수영장 목록과 같은 계열을 유지한다.
//
// 개수·화면 폭 대응:
//   가로 스크롤 한 줄로 둔다. 카드 폭을 컨테이너의 1/3 로 고정하므로
//   - 3개 이하면 딱 맞아 스크롤이 생기지 않는다(줄바꿈 그리드와 같은 모습).
//   - 4개 이상이면 넘쳐서 스크롤되고, 다음 카드가 살짝 걸쳐 보여 더 있다는 게 드러난다.
//   여러 줄 그리드로 두면 개수에 따라 마지막 줄이 한 칸만 남는 등 모양이 무너지는데,
//   한 줄 스크롤은 개수가 몇 개든 형태가 같다.
//   좁은 화면에서도 3장이 스크롤 없이 들어가야 해서 하한(CARD_MIN)은 아주 낮게만 둔다.
//   320px 기기에서 1/3 폭이 약 78px 이라, 하한을 그보다 높게 잡으면 3개짜리에도
//   스크롤이 생겨 어색해진다(실측).
const CARD_MIN = 72;
const VISIBLE_CARDS = 3;
// 넘칠 때 다음 카드가 걸쳐 보이는 폭. 화면 폭과 무관하게 이만큼 일정하게 보인다.
// 비율(예: 3.3칸)로 나누면 좁은 화면에서 5px 까지 줄어 잘린 것처럼 보인다(실측).
const PEEK = 32;

export default function GearSection() {
  const items = useGear();
  if (items.length === 0) return null;

  // 3개 이하: 카드 3장 + 사이 간격 2개가 화면 폭에 딱 맞아 스크롤이 없다.
  // 4개 이상: 간격 3개와 PEEK 만큼을 더 빼서, 다음 카드가 항상 32px 걸쳐 보인다.
  const overflowing = items.length > VISIBLE_CARDS;
  const reserved = overflowing
    ? space.md * VISIBLE_CARDS + PEEK
    : space.md * (VISIBLE_CARDS - 1);
  const cardWidth = `max(${CARD_MIN}px, calc((100% - ${reserved}px) / ${VISIBLE_CARDS}))`;

  return (
    <Section title="쇼핑">
      {/* 대가성 문구는 상품 소개 바로 위. 운영정책이 "본문 끝에만 표시"를 부족할 수 있는 예로 든다. */}
      <div style={{ marginBottom: space.md }}>
        <Caption>{GEAR_DISCLOSURE}</Caption>
      </div>

      <ul
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: space.md,
          listStyle: "none",
          margin: `0 -${space.xxl}px`, // 섹션 좌우 패딩을 상쇄해 화면 끝까지 흐르게 한다
          padding: `0 ${space.xxl}px`,
          overflowX: "auto",
          scrollSnapType: "x proximity",
          scrollPaddingLeft: space.xxl,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              flex: "0 0 auto",
              width: cardWidth,
              scrollSnapAlign: "start",
            }}
          >
            <button
              type="button"
              onClick={() => void openExternal(item.url)}
              title={item.name}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {/* 토스 CDN 이미지를 그대로 참조한다. 저장·가공하지 않는다. */}
              <img
                src={item.image}
                alt=""
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: radius.md,
                  background: color.fill,
                }}
              />
              {/* 상품명은 판매 페이지 그대로 두고 화면에서만 두 줄로 자른다.
                  임의로 줄이면 실제 판매 상품과 이름이 달라진다. */}
              <div style={{ marginTop: space.sm }}>
                <Text typography="t7" color={color.textSub} ellipsisAfterLines={2}>
                  {item.name}
                </Text>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
