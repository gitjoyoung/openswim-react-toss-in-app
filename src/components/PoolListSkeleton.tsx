import { memo } from "react";
import { List, ListRow } from "@toss/tds-mobile";
import { radius } from "../design/tokens";

// PoolList 의 행과 같은 골격을 회색 블록으로 깐다.
// 크기를 PoolList 와 맞춰야 데이터가 도착할 때 목록이 튀지 않는다.
// (PoolList: 썸네일 52px / radius 16, 제목 t5 bold, 메타 t7, 오른쪽 즐겨찾기 버튼)
const THUMB = 52;

function Bar({ width, height }: { width: number | string; height: number }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius.sm }}
    />
  );
}

// 행마다 제목·메타 길이를 조금씩 다르게 해서 실제 목록처럼 보이게 한다.
// 값을 매번 새로 뽑으면 리렌더마다 폭이 흔들리므로 고정 배열을 쓴다.
const WIDTHS: ReadonlyArray<readonly [string, string]> = [
  ["62%", "38%"],
  ["48%", "45%"],
  ["70%", "32%"],
  ["55%", "42%"],
  ["66%", "36%"],
  ["44%", "48%"],
  ["58%", "34%"],
  ["72%", "40%"],
];

export default memo(function PoolListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden="true" data-testid="pool-list-skeleton">
      <List>
        {Array.from({ length: rows }, (_, i) => {
          const [titleWidth, metaWidth] = WIDTHS[i % WIDTHS.length];
          return (
            <ListRow
              key={i}
              horizontalPadding="small"
              left={
                <div
                  className="skeleton"
                  style={{
                    width: THUMB,
                    height: THUMB,
                    flexShrink: 0,
                    borderRadius: 16,
                  }}
                />
              }
              contents={
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                    minWidth: 0,
                    width: "100%",
                  }}
                >
                  <Bar width={titleWidth} height={15} />
                  <Bar width={metaWidth} height={12} />
                </div>
              }
              right={
                <div
                  className="skeleton"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.sm,
                    marginRight: 4,
                  }}
                />
              }
            />
          );
        })}
      </List>
    </div>
  );
});
