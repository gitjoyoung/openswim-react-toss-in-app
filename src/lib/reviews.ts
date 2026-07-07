import { sbSelect, sbInsert } from "../supabase";
import type { Database } from "../database.types";

// 수영장별 제보·후기. 로그인 없이 익명 작성(닉네임 선택). RLS: 읽기/쓰기 anon 허용.
export type Review = Database["public"]["Tables"]["pool_reviews"]["Row"];

export const BODY_MAX = 300;
export const NICK_MAX = 20;

export async function fetchReviews(poolId: string): Promise<Review[]> {
  const q = `pool_reviews?select=*&pool_id=eq.${encodeURIComponent(poolId)}&order=created_at.desc`;
  return sbSelect<Review>(q);
}

export async function addReview(poolId: string, body: string, nickname?: string): Promise<Review> {
  return sbInsert<Review>("pool_reviews", {
    pool_id: poolId,
    body: body.trim().slice(0, BODY_MAX),
    nickname: nickname?.trim() ? nickname.trim().slice(0, NICK_MAX) : null,
  });
}

// "3분 전 / 2일 전 / 2026.07.06" 형태의 상대·절대 혼합 표기.
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  const dt = new Date(iso);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}
