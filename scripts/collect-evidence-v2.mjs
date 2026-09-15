// 증거 수집 v2. 스킬이 요구하는 번들(원본 HTML + 줄번호 텍스트 + manifest)을 반드시 남긴다.
// 스크린샷은 이 스크립트가 못 찍는다(저장소에 브라우저 드라이버 없음). screenshotPending=true 로 표시하고
// REPL 브라우저 단계에서 채운다. scripts/README-evidence.md 참고.
// 사용: TARGETS=docs/data/worksplit/B-evidence-targets.json OUT=evidence/new-candidates node scripts/collect-evidence-v2.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TARGETS = process.env.TARGETS;
const OUT = process.env.OUT ?? "evidence/new-candidates";
const TODAY = new Date().toISOString().slice(0, 10);
const TIMEOUT = 20000;

const clean = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<br\s*\/?>/gi,"\n").replace(/<\/(tr|p|div|li|h\d|table|td|th)>/gi,"\n")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/[ \t]+/g," ").split("\n").map(s=>s.trim()).filter(Boolean).join("\n");

// TLS 체인이 불완전한 한국 공공기관 사이트가 많다. 검증 실패 시 한 번만 우회 재시도하고
// manifest 에 tlsVerified:false 로 반드시 기록한다. 조용히 넘어가지 않는다.
async function get(url) {
  const attempt = async (skipTls) => {
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (skipTls) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { redirect: "follow", signal: c.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; OpenswimAudit/2.0)", accept: "text/html,*/*" } });
      return { res: r, html: await r.text(), tlsVerified: !skipTls };
    } finally {
      clearTimeout(t);
      if (skipTls) { if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev; }
    }
  };
  try { return await attempt(false); }
  catch (e) {
    const code = e.cause?.code ?? e.name;
    if (!/CERT|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(String(code))) throw e;
    const r = await attempt(true);
    r.tlsError = code;
    return r;
  }
}

const targets = JSON.parse(fs.readFileSync(TARGETS, "utf8"));
const summary = [];
for (const t of targets) {
  const dir = path.join(OUT, t.slug, TODAY);
  fs.mkdirSync(path.join(dir, "html"), { recursive: true });
  const manifest = { slug: t.slug, name: t.name, poolId: t.poolId ?? null, collectedAt: new Date().toISOString(),
    screenshotPending: true, pages: [] };
  let text = "";
  let i = 0;
  for (const url of t.urls) {
    try {
      const { res, html, tlsVerified, tlsError } = await get(url);
      const file = `html/${String(i).padStart(2,"0")}.html`;
      fs.writeFileSync(path.join(dir, file), html);
      manifest.pages.push({ url, finalUrl: res.url, status: res.status, bytes: html.length,
        sha256: crypto.createHash("sha256").update(html).digest("hex"),
        fetchedAt: new Date().toISOString(), fetchMode: "http-fetch-no-js",
        tlsVerified, ...(tlsError ? { tlsError } : {}), file });
      text += `\n\n===== ${url} (status ${res.status}, tlsVerified ${tlsVerified}) =====\n` + clean(html);
    } catch (e) {
      manifest.pages.push({ url, error: String(e.cause?.code ?? e.message), fetchedAt: new Date().toISOString() });
      text += `\n\n===== ${url} (수집 실패: ${e.cause?.code ?? e.message}) =====\n`;
    }
    i++;
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
  fs.writeFileSync(path.join(dir, "page-text.txt"),
    text.split("\n").map((l, n) => `${String(n+1).padStart(5)}| ${l}`).join("\n"));
  const ok = manifest.pages.filter(p => p.status === 200).length;
  const tlsBypass = manifest.pages.filter(p => p.tlsVerified === false).length;
  summary.push({ slug: t.slug, name: t.name, ok, total: t.urls.length, tlsBypass });
  console.log(`${ok === t.urls.length ? "OK  " : "일부"} ${t.name} | 200응답 ${ok}/${t.urls.length}${tlsBypass ? ` | TLS우회 ${tlsBypass}` : ""}`);
}
fs.writeFileSync(path.join(OUT, `summary-v2-${TODAY}.json`), JSON.stringify(summary, null, 1));
