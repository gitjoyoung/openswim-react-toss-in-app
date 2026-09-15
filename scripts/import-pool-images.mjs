// Import reviewed pool images into Cloudflare R2 and Neon.
// The manifest is intentionally explicit: image discovery/review happens before
// any upload, so low-quality or unverified images cannot reach production.
//
// Required for a real import:
//   NEON_DATABASE_URL
//   R2_BUCKET_NAME
//   R2_PUBLIC_BASE_URL (custom domain or public r2.dev URL)
//
// Usage:
//   node scripts/import-pool-images.mjs --dry-run
//   node scripts/import-pool-images.mjs

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const pg = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const ROOT = path.resolve(".");
const MANIFEST_PATH = process.env.POOL_IMAGE_MANIFEST ?? path.join(ROOT, "docs/data/pool-image-sources.json");
const MIN_WIDTH = Number(process.env.MIN_IMAGE_WIDTH ?? 800);
const MIN_HEIGHT = Number(process.env.MIN_IMAGE_HEIGHT ?? 450);
const CWEBP_BIN = process.env.CWEBP_BIN ?? "/opt/homebrew/bin/cwebp";
const WRANGLER_BIN = process.env.WRANGLER_BIN ?? "npx";

export function validateManifest(entries) {
  const errors = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      errors.push("entry: must be an object");
      continue;
    }
    const poolId = typeof entry.poolId === "string" ? entry.poolId : "entry";
    if (ids.has(poolId)) errors.push(`${poolId}: duplicate poolId`);
    ids.add(poolId);
    const imageEntries = Array.isArray(entry.images)
      ? entry.images
      : [{ imageUrl: entry.imageUrl, sourceUrl: entry.sourceUrl }];
    if (!imageEntries.length) errors.push(`${poolId}: at least one image is required`);
    for (const [index, image] of imageEntries.entries()) {
      for (const field of ["sourceUrl", "imageUrl"]) {
        if (!image?.[field]) errors.push(`${poolId}: images[${index}].${field} is required`);
        else {
          try {
            const url = new URL(image[field]);
            if (!/^https?:$/.test(url.protocol)) errors.push(`${poolId}: images[${index}].${field} must be http(s)`);
          } catch {
            errors.push(`${poolId}: images[${index}].${field} must be a URL`);
          }
        }
      }
    }
  }
  return errors;
}

export function buildObjectKey(poolId, index = 0) {
  return index === 0 ? `pools/${poolId}.webp` : `pools/${poolId}-${index}.webp`;
}

export function qualityGate({ width, height }) {
  return width >= MIN_WIDTH && height >= MIN_HEIGHT ? "ok" : "too-small";
}

async function readManifest() {
  const entries = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(entries)) throw new Error("이미지 manifest는 배열이어야 합니다");
  const errors = validateManifest(entries);
  if (errors.length) throw new Error(`manifest 오류:\n${errors.join("\n")}`);
  return entries;
}

async function imageDimensions(filePath) {
  const { stdout } = await execFileAsync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath]);
  const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`이미지 크기를 읽을 수 없습니다: ${filePath}`);
  return { width, height };
}

async function downloadImage(url, outputPath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Openswim image importer/1.0", accept: "image/*,*/*;q=0.8" },
    });
    if (!response.ok) throw new Error(`이미지 다운로드 실패 ${response.status}: ${url}`);
    await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  } finally {
    clearTimeout(timer);
  }
}

async function downloadAndConvert(entry, outputPath) {
  const inputPath = `${outputPath}.input`;
  await downloadImage(entry.imageUrl, inputPath);
  const dimensions = await imageDimensions(inputPath);
  const gate = qualityGate(dimensions);
  if (gate !== "ok") throw new Error(`해상도 부족 ${dimensions.width}x${dimensions.height}: ${entry.poolId}`);
  const header = await fs.readFile(inputPath, { encoding: null });
  let conversionInput = inputPath;
  if (header.subarray(0, 6).toString("ascii") === "GIF87a" || header.subarray(0, 6).toString("ascii") === "GIF89a") {
    const pngPath = `${outputPath}.png`;
    await execFileAsync("sips", ["-s", "format", "png", inputPath, "--out", pngPath]);
    conversionInput = pngPath;
  }
  await execFileAsync(CWEBP_BIN, ["-quiet", "-q", "84", conversionInput, "-o", outputPath]);
  return dimensions;
}

async function uploadToR2({ bucket, objectKey, filePath }) {
  const args = WRANGLER_BIN === "npx" ? ["--yes", "wrangler"] : [];
  await execFileAsync(WRANGLER_BIN, [
    ...args,
    "r2", "object", "put", `${bucket}/${objectKey}`,
    "--remote", "--file", filePath, "--content-type", "image/webp", "--force",
  ]);
}

async function main() {
  const entries = await readManifest();
  console.log(`검수된 이미지 ${entries.length}건`);
  if (process.argv.includes("--dry-run")) return;

  const config = {
    neonUrl: process.env.NEON_DATABASE_URL,
    bucket: process.env.R2_BUCKET_NAME ?? "static",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, ""),
  };
  if (!config.neonUrl || !config.publicBaseUrl) {
    throw new Error("NEON_DATABASE_URL, R2_PUBLIC_BASE_URL가 필요합니다");
  }

  const client = new pg.Client({ connectionString: config.neonUrl, ssl: { rejectUnauthorized: true } });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openswim-pool-images-"));
  try {
    await client.connect();
    await client.query("BEGIN");
    for (const entry of entries) {
      const imageEntries = Array.isArray(entry.images)
        ? entry.images
        : [{ imageUrl: entry.imageUrl, sourceUrl: entry.sourceUrl, sourceNote: entry.sourceNote }];
      const publicUrls = [];
      for (const [index, image] of imageEntries.entries()) {
        const objectKey = buildObjectKey(entry.poolId, index);
        const outputPath = path.join(tempDir, `${entry.poolId}-${index}.webp`);
        await downloadAndConvert(image, outputPath);
        await uploadToR2({ ...config, objectKey, filePath: outputPath });
        publicUrls.push(`${config.publicBaseUrl}/${objectKey}`);
      }
      await client.query(
        "UPDATE public.pools SET images = $1::text[], updated_at = now() WHERE id = $2::uuid",
        [publicUrls, entry.poolId],
      );
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ imported: entries.length, bucket: config.bucket }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
