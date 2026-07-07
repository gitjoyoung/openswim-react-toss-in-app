import { useEffect, useState } from "react";
import { Button, Text } from "@toss/tds-mobile";
import { Section, Caption } from "../design/primitives";
import { color, space, radius, brand } from "../design/tokens";
import { fetchReviews, addReview, BODY_MAX, NICK_MAX, type Review } from "../lib/reviews";

const DANGER = "#f04452";

// 작성 시각을 "yy.mm.dd HH:mm"로 일관 표기.
function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getFullYear() % 100)}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 이니셜 뱃지 색 — 작성자별로 구분되게(같은 키=같은 색). 배경/글자 짝.
const BADGE_COLORS = [
  { bg: "#E8F3FF", fg: "#3182F6" },
  { bg: "#FFF1E8", fg: "#F5842A" },
  { bg: "#EAF7ED", fg: "#22A05B" },
  { bg: "#FDEBF1", fg: "#E84B8A" },
  { bg: "#F0ECFB", fg: "#7B5CD6" },
  { bg: "#E7F6F5", fg: "#17A2A0" },
  { bg: "#FFF4DE", fg: "#C99400" },
];
function badgeColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}

// 상세 하단 제보·후기. 로그인 없이 익명 작성. 빠진 정보(시간표·요금) 제보 수집이 주목적.
export default function PoolReviews({ poolId }: { poolId: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setReviews(null);
    fetchReviews(poolId)
      .then((r) => live && setReviews(r))
      .catch(() => live && setReviews([]));
    return () => {
      live = false;
    };
  }, [poolId]);

  async function submit() {
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const saved = await addReview(poolId, text, nickname);
      setReviews((prev) => [saved, ...(prev ?? [])]);
      setBody("");
      setNickname("");
    } catch {
      setErr("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const count = reviews?.length ?? 0;

  return (
    <Section title={`제보 · 후기${count ? ` ${count}` : ""}`}>
      {/* 목록 — 댓글마다 카드로 구분 */}
      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {reviews == null ? (
          <Caption>불러오는 중…</Caption>
        ) : count === 0 ? (
          // 빈 상태도 후기 카드와 동일한 모양으로 (어색하지 않게)
          <div style={{ background: color.fill, borderRadius: radius.lg, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: brand.tint,
                  color: brand.main,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                }}
              >
                💬
              </span>
              <Text typography="t7" fontWeight="bold" color={color.textStrong}>
                아직 후기가 없어요
              </Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text typography="t6" color={color.textMuted}>
                첫 후기를 남겨주세요. 빠진 시간표·요금이나 방문 팁 모두 좋아요.
              </Text>
            </div>
          </div>
        ) : (
          reviews.map((r) => {
            const bc = badgeColor(r.nickname || r.id); // 작성자별 색 (익명은 글마다 다르게)
            return (
              <div
                key={r.id}
                style={{
                  background: color.fill,
                  borderRadius: radius.lg,
                  padding: "13px 15px",
                }}
              >
                {/* 헤더: 이니셜 뱃지(작성자색) + 닉네임 + 시간 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: bc.bg,
                      color: bc.fg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {r.nickname ? r.nickname.trim()[0] : "익"}
                  </span>
                  <Text typography="t7" fontWeight="bold" color={color.textStrong}>
                    {r.nickname || "익명"}
                  </Text>
                  <Caption>{fmtDate(r.created_at)}</Caption>
                </div>
                {/* 본문이 핵심 */}
                <div style={{ marginTop: 8 }}>
                  <Text typography="t6" color={color.textStrong}>
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.body}</span>
                  </Text>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 작성 카드 — 목록 아래 */}
      <div
        style={{
          marginTop: space.xl,
          border: `1px solid ${focused ? brand.main : color.divider}`,
          borderRadius: radius.md,
          overflow: "hidden",
          transition: "border-color .15s",
          background: color.bg,
        }}
      >
        <input
          value={nickname}
          maxLength={NICK_MAX}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 (선택)"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            outline: "none",
            padding: "11px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: color.textStrong,
            background: "transparent",
            borderBottom: `1px solid ${color.divider}`,
          }}
        />
        <textarea
          value={body}
          maxLength={BODY_MAX}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setBody(e.target.value)}
          placeholder="예) 평일 저녁 8시에도 자유수영 해요 / 주말 성인 5,000원이에요"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            outline: "none",
            padding: "12px 14px",
            fontSize: 14,
            lineHeight: 1.55,
            color: color.textStrong,
            background: "transparent",
            resize: "none",
            display: "block",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            padding: "8px 10px 8px 14px",
            background: color.fill,
          }}
        >
          <Caption>
            {body.length}/{BODY_MAX}
          </Caption>
          <Button size="small" onClick={submit} loading={submitting} disabled={!body.trim()}>
            등록
          </Button>
        </div>
      </div>
      {err && (
        <div style={{ marginTop: space.sm }}>
          <Text typography="t7" color={DANGER}>
            {err}
          </Text>
        </div>
      )}
    </Section>
  );
}
