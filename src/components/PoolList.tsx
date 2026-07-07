import { List, ListRow, Text } from "@toss/tds-mobile";
import type { Pool } from "../supabase";
import { images, type RowStatus } from "../lib/pools";
import { shortSido } from "../lib/search";
import { color, status, dayColor } from "../design/tokens";
import FavStar from "./FavStar";
import freeImg from "../assets/free.webp"; // 사진 없는 곳 기본 이미지

// 운영요일 문구에서 평일=검정, 토요일=파랑, 일요일=빨강 (달력 컬러, dayColor 규칙). 나머지는 상위 색 상속.
function renderDays(text: string) {
  return text.split(/(평일|토요일|일요일)/).map((seg, i) =>
    seg === "평일" ? (
      <span key={i} style={{ color: dayColor.weekday }}>
        {seg}
      </span>
    ) : seg === "토요일" ? (
      <span key={i} style={{ color: dayColor.sat }}>
        {seg}
      </span>
    ) : seg === "일요일" ? (
      <span key={i} style={{ color: dayColor.sun }}>
        {seg}
      </span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

// 썸네일: 모든 행이 동일한 정사각 영역. 이미지는 cover로 꽉 채우고, 없으면 기본 이미지(free).
const THUMB = 52;
function Thumb({ pool }: { pool: Pool }) {
  const src = images(pool)[0] ?? freeImg;
  return (
    <div style={{ width: THUMB, height: THUMB, flexShrink: 0, borderRadius: 16, overflow: "hidden", background: color.fill }}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

type Props = {
  pools: Pool[];
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
  statusOf: (pool: Pool) => RowStatus; // 필터 맥락에 맞춘 상태 문구(오늘/토요일 등)
  distanceText?: (pool: Pool) => string | null; // 내 위치 정렬 시 거리 표시
};

export default function PoolList({ pools, favs, onToggleFav, onSelect, statusOf, distanceText }: Props) {
  return (
    <List>
      {pools.map((p) => {
        const dist = distanceText?.(p);
        const st = statusOf(p);
        // 전국이라 구만 쓰면 모호("서구"). 시도 축약 붙여 "부산 서구"로.
        const region = p.sido ? `${shortSido(p.sido)} ${p.gu}` : p.gu;
        return (
        <ListRow
          key={p.id}
          onClick={() => onSelect(p)}
          left={<Thumb pool={p} />}
          contents={
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <Text typography="t5" fontWeight="bold" ellipsisAfterLines={1}>
                {p.name}
              </Text>
              <Text typography="t7" ellipsisAfterLines={1}>
                {st.text && (
                  <span
                    style={{
                      color:
                        st.tone === "open"
                          ? status.open
                          : st.tone === "closed"
                            ? status.closed
                            : st.tone === "unknown"
                              ? status.unknown
                              : color.textSub,
                      fontWeight: 700,
                    }}
                  >
                    {renderDays(st.text)}
                  </span>
                )}
                <span style={{ color: color.textMuted }}>
                  {st.text ? ` · ${region}` : region}
                  {dist ? ` · ${dist}` : ""}
                </span>
              </Text>
            </div>
          }
          right={
            <button
              aria-label="즐겨찾기"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav(p.id);
              }}
              style={{
                border: "none",
                background: "none",
                padding: 10, // 탭 타겟 ~44 (별 24 + 여백)
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FavStar on={favs.includes(p.id)} />
            </button>
          }
        />
        );
      })}
    </List>
  );
}
