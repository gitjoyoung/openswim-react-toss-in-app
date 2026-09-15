#!/usr/bin/env node
// public.gear_items 의 url 을 따라가 og 정보(상품명·이미지)를 채운다.
//
// 운영 흐름:
//   1) DB에 url 한 줄 insert    (운영자가 하는 일은 이것뿐)
//   2) node scripts/sync-gear.mjs
//   3) 앱이 갱신된 목록을 자동으로 보여준다
//
// 왜 서버(스크립트)에서 og 를 읽는가:
//   토스 웹뷰/브라우저에서 toss.im, toss.shopping 을 직접 fetch 하면 CORS 로 막힌다
//   (실측: "Failed to fetch"). 이미지 URL 자체는 <img> 로 잘 로드된다.
//   그래서 제목·이미지 주소만 여기서 뽑아 DB 에 넣고, 이미지는 런타임에 토스 CDN 에서 바로 받는다.
//   이미지를 우리 쪽에 저장·가공하지 않으므로 권리 문제를 만들지 않는다.
//
// 사용법:
//   set -a; source .env; set +a
//   node scripts/sync-gear.mjs [--all] [--dry-run]
//     기본값은 아직 동기화되지 않았거나 실패한 행만 처리한다.
//     --all 은 이미 채워진 행까지 다시 읽는다(상품명·이미지 교체 반영).
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// pg 는 앱 런타임 의존성이 아니라서 마이그레이션 폴더의 것을 재사용한다.
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("NEON_DATABASE_URL 이 설정되지 않았습니다");

const syncAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");
const FALLBACK_PATH = path.resolve("src/data/gear.generated.json");

const meta = (html, prop) =>
  html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
  )?.[1] ?? null;

// "아레나 웨이브마크 4부 남성 수영복 ... , 1개 | 토스쇼핑" → 뒤의 사이트명만 뗀다.
// 상품명 자체는 손대지 않는다. 임의로 줄이면 실제 판매 상품과 달라진다.
const cleanTitle = (raw) => raw.replace(/\s*\|\s*토스쇼핑\s*$/, "").trim();

async function readOg(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = meta(html, "og:title");
  const image = meta(html, "og:image");
  if (!title) throw new Error("og:title 없음 (링크 만료 또는 상품 내림)");
  if (!image) throw new Error("og:image 없음");
  return {
    name: cleanTitle(title),
    imageUrl: image,
    productId: res.url.match(/\/t\/(\d+)/)?.[1] ?? null,
  };
}

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(
      syncAll
        ? `select id, url from public.gear_items where is_active order by sort_order, created_at`
        : `select id, url from public.gear_items
             where is_active and (name is null or image_url is null or sync_error is not null)
             order by sort_order, created_at`,
    );
    console.log(`${rows.length}건 동기화 대상${dryRun ? " (dry-run)" : ""}`);

    let failed = 0;
    for (const row of rows) {
      try {
        const og = await readOg(row.url);
        console.log(`  ok  ${og.name}`);
        if (dryRun) continue;
        await client.query(
          `update public.gear_items
              set name = $2, image_url = $3, product_id = $4, synced_at = now(), sync_error = null
            where id = $1`,
          [row.id, og.name, og.imageUrl, og.productId],
        );
      } catch (error) {
        failed += 1;
        console.error(`  !!  ${row.url} → ${error.message}`);
        if (dryRun) continue;
        // 실패해도 기존 name/image 는 지우지 않는다. 지우면 화면에서 조용히 사라진다.
        // 대신 사유를 남겨서 링크 관리 때 보이게 한다.
        await client.query(
          `update public.gear_items set sync_error = $2, synced_at = now() where id = $1`,
          [row.id, error.message],
        );
      }
    }

    // 앱 폴백용 번들 JSON. Neon 장애 때 pools.json 과 같은 역할을 한다.
    const { rows: visible } = await client.query(
      `select coalesce(product_id, id::text) as id, name, note, image_url, url
         from public.gear_items
        where is_active and name is not null and image_url is not null
        order by created_at desc, sort_order`,
    );
    if (!dryRun) {
      await fs.writeFile(
        FALLBACK_PATH,
        JSON.stringify(
          {
            syncedAt: new Date().toISOString(),
            items: visible.map((r) => ({
              id: r.id,
              name: r.name,
              note: r.note,
              image: r.image_url,
              url: r.url,
            })),
          },
          null,
          2,
        ) + "\n",
      );
    }
    console.log(`\n노출 대상 ${visible.length}건${dryRun ? "" : " → src/data/gear.generated.json 갱신"}`);
    if (failed > 0) {
      console.error(`${failed}건 실패. sync_error 컬럼을 확인하세요.`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

await main();
