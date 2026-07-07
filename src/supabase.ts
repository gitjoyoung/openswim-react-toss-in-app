import type { Database } from "./database.types";

// supabase-js SDK 대신 PostgREST를 fetch로 직접 호출 (번들 ~35KB gzip 절감).
// 쓰는 건 pools/pool_reviews 읽기 + 리뷰 1건 insert뿐이라 SDK가 과함.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 가 .env 에 없어요.");
}

const REST = `${url}/rest/v1`;
const baseHeaders = { apikey: key, Authorization: `Bearer ${key}` };

// GET /rest/v1/<query>. query는 PostgREST 문법 (예: "pools?select=*&order=name").
export async function sbSelect<T>(query: string): Promise<T[]> {
  const res = await fetch(`${REST}/${query}`, { headers: baseHeaders });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

// POST /rest/v1/<table>. 삽입 후 생성된 행(첫 번째)을 반환.
export async function sbInsert<T>(table: string, row: object): Promise<T> {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers: { ...baseHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as T[];
  return rows[0];
}

export type Pool = Database["public"]["Tables"]["pools"]["Row"];
