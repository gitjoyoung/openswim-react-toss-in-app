import { memo } from "react";
import { List, ListRow, Text } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import { images, type RowStatus } from "../lib/pools";
import { shortSido } from "../lib/search";
import { color, status, dayColor } from "../design/tokens";
import FavStar from "./FavStar";
import AccessNotice from "./AccessNotice";
import freeThumb from "../assets/free-thumb.webp"; // 사진 없는 곳 기본 이미지 (목록용 축소본)

// 운영요일 문구에서 평일=검정, 토요일=파랑, 일요일=빨강 (달력 컬러, dayColor 규칙). 나머지는 상위 색 상속.
function renderDays(text: string) {
  return text.split(/(평일|토요일|일요일)/).map((seg, i) =>
    seg === "평일" ? (
      <span key={i} style={{ color: dayColor.weekday }}>{seg}</span>
    ) : seg === "토요일" ? (
      <span key={i} style={{ color: dayColor.sat }}>{seg}</span>
    ) : seg === "일요일" ? (
      <span key={i} style={{ color: dayColor.sun }}>{seg}</span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

const THUMB = 52;
const Thumb = memo(function Thumb({ pool }: { pool: Pool }) {
  const src = images(pool)[0] ?? freeThumb;
  return (
    <div style={{ width: THUMB, height: THUMB, flexShrink: 0, borderRadius: 16, overflow: "hidden", background: color.fill }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        width={THUMB}
        height={THUMB}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
});

type RowProps = {
  pool: Pool;
  isFav: boolean;
  st: RowStatus;
  meta: string;
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
};

// 개별 행을 memo — favs나 상태가 안 바뀐 행은 부모 리렌더 시에도 건너뜀.
const PoolRow = memo(function PoolRow({ pool, isFav, st, meta, onToggleFav, onSelect }: RowProps) {
  return (
    <ListRow
      horizontalPadding="small"
      onClick={() => onSelect(pool)}
      left={<Thumb pool={pool} />}
      contents={
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Text typography="t5" fontWeight="bold" ellipsisAfterLines={1}>
              {pool.name}
            </Text>
            {/* 상세까지 들어갔다 되돌아 나오는 게 제일 나쁜 경험이라 목록에서도 알린다. */}
            <AccessNotice pool={pool} compact />
          </div>
          <Text typography="t7" ellipsisAfterLines={1}>
            {st.text && (
              <span
                style={{
                  color:
                    st.tone === "open" ? status.open
                    : st.tone === "closed" ? status.closed
                    : st.tone === "unknown" ? status.unknown
                    : color.textSub,
                  fontWeight: 700,
                }}
              >
                {renderDays(st.text)}
              </span>
            )}
            <span style={{ color: color.textMuted }}>
              {st.text ? `  ${meta}` : meta}
            </span>
          </Text>
        </div>
      }
      right={
        <button
          aria-label="즐겨찾기"
          onClick={(e) => { e.stopPropagation(); onToggleFav(pool.id); }}
          style={{
            border: "none", background: "none",
            padding: 10, margin: "-10px -10px -10px -4px",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <FavStar on={isFav} />
        </button>
      }
    />
  );
});

type Props = {
  pools: Pool[];
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
  statusOf: (pool: Pool) => RowStatus;
  distanceText?: (pool: Pool) => string | null;
};

// favSet으로 includes O(n) → O(1) 변환.
export default memo(function PoolList({ pools, favs, onToggleFav, onSelect, statusOf, distanceText }: Props) {
  const favSet = new Set(favs);
  return (
    <List>
      {pools.map((p) => {
        const dist = distanceText?.(p);
        const region = p.sido ? `${shortSido(p.sido)} ${p.gu}` : p.gu;
        const meta = dist ?? region;
        const st = statusOf(p);
        return (
          <PoolRow
            key={p.id}
            pool={p}
            isFav={favSet.has(p.id)}
            st={st}
            meta={meta}
            onToggleFav={onToggleFav}
            onSelect={onSelect}
          />
        );
      })}
    </List>
  );
});
