import type { Pool } from "../pool";
import { color, radius, space, status } from "../design/tokens";

// 이용 대상 제한(여성 전용, 어린이 입장 불가 등)을 알린다.
//
// 무엇을 넣는가: 이 앱은 비회원이 오늘 가서 자유수영을 할 수 있는지를 본다.
// 그래서 **신분 때문에 입장이 막히는 경우**만 배지로 쓴다.
// 회원 전용 시간대(어차피 비회원 기준 데이터다), 특정 요일만 운영(시간표가 이미 보여준다),
// 방역·수질정화 같은 시간대 운영은 넣지 않는다. 당연한 값을 배지로 쓰면 목록만 시끄러워진다.
//
// 값은 DB(pools.access_label / access_note)에서 오는 자유 텍스트다.
// 분류를 코드에 두지 않는 이유: 새로운 제한 유형이 나올 때마다 배포해야 하기 때문이다.
// 대신 access_label 은 배지에 들어갈 만큼 짧게 쓰기로 하고, 긴 설명은 access_note 에 둔다.
//
// 위치는 화면 맨 위(수영장 이름 바로 아래)다. 시설 섹션은 화면 끝이라
// 헛걸음을 막아야 하는 정보를 두기에 늦다.
export default function AccessNotice({
  pool,
  compact = false,
}: {
  pool: Pool;
  compact?: boolean;
}) {
  const label = pool.access_label?.trim();
  if (!label) return null;

  const badge = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        padding: compact ? "1px 6px" : "3px 9px",
        borderRadius: radius.sm,
        background: "rgba(245, 166, 35, 0.14)",
        color: "#b06f00", // 주황 배경 위에서 대비를 확보한 값
        fontSize: compact ? 11 : 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );

  // 목록 카드에서는 배지만. 한 줄 안에 이름과 나란히 놓인다.
  if (compact) return badge;

  const note = pool.access_note?.trim();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: space.sm,
        margin: `${space.md}px ${space.lg}px 0`,
        padding: `${space.sm}px ${space.md}px`,
        borderRadius: radius.md,
        background: color.fill,
        borderLeft: `3px solid ${status.unknown}`,
      }}
    >
      {badge}
      {note && (
        <span style={{ fontSize: 13, lineHeight: 1.45, color: color.textSub }}>{note}</span>
      )}
    </div>
  );
}
