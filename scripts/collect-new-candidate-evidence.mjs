// 신규 후보 시설용 증거 수집기. DB id가 없는 시설을 name+homepage 로 크롤링한다.
// 사용: TARGETS=docs/data/worksplit/B-targets.json OUT=tmp/b-evidence node scripts/collect-new-candidate-evidence.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TARGETS = process.env.TARGETS ?? "docs/data/worksplit/B-targets.json";
const OUT = process.env.OUT ?? "evidence/new-candidates";
const TODAY = new Date().toISOString().slice(0, 10);
const TIMEOUT = 15000, MAX_LINKS = 12, CONCURRENCY = 2;

const linkWord = /(자유수영|자유\s*수영|이용안내|이용\s*안내|운영안내|시간표|요금|이용료|수영장|프로그램|강습|시설안내|센터소개|pool|swim)/i;
const clean = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<br\s*\/?>/gi,"\n").replace(/<\/(tr|p|div|li|h\d|table)>/gi,"\n")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/[ \t]+/g," ")
  .split("\n").map(s=>s.trim()).filter(Boolean).join("\n");

async function get(url){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),TIMEOUT);
  try{ return await fetch(url,{redirect:"follow",signal:c.signal,
    headers:{"user-agent":"Mozilla/5.0 (compatible; OpenswimAudit/2.0)",accept:"text/html,*/*"}}); }
  finally{ clearTimeout(t); }
}
function origin(u){ const m=String(u).match(/^https?:\/\/[^/]+/); return m?m[0]:null; }
function links(html, base){
  const o=origin(base); if(!o) return [];
  const out=[], seen=new Set();
  for(const tag of html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi)??[]){
    const href=tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const text=clean(tag);
    if(!href||href.startsWith("#")||/^(javascript|mailto|tel):/i.test(href)) continue;
    if(!linkWord.test(text)&&!linkWord.test(href)) continue;
    let abs = href.startsWith("http") ? href : (href.startsWith("/") ? o+href : base.replace(/\/[^/]*$/,"/")+href);
    if(origin(abs)!==o) continue;
    if(seen.has(abs)) continue; seen.add(abs); out.push({url:abs,text:text.slice(0,60)});
    if(out.length>=MAX_LINKS) break;
  }
  return out;
}
// 전각 물결 포함
const TIME = /(\d{1,2}\s*:\s*\d{2})\s*[~\-–—～∼〜－]\s*(\d{1,2}\s*:\s*\d{2})/g;

const targets = JSON.parse(fs.readFileSync(TARGETS,"utf8"));
const results = [];
async function work(t){
  const dir = path.join(OUT, t.slug, TODAY);
  fs.mkdirSync(dir,{recursive:true});
  const manifest=[], pages=[];
  const queue=[{url:t.homepage,text:"홈"}];
  try{
    const r0=await get(t.homepage); const h0=await r0.text();
    queue.push(...links(h0,r0.url||t.homepage));
    manifest.push({url:t.homepage,finalUrl:r0.url,status:r0.status,bytes:h0.length,sha256:crypto.createHash("sha256").update(h0).digest("hex"),fetchedAt:new Date().toISOString(),fetchMode:"http-fetch-no-js"});
    pages.push({url:r0.url||t.homepage,text:clean(h0)});
  }catch(e){ manifest.push({url:t.homepage,error:String(e.message??e)}); }
  for(const l of queue.slice(1)){
    try{
      const r=await get(l.url); const h=await r.text();
      manifest.push({url:l.url,linkText:l.text,finalUrl:r.url,status:r.status,bytes:h.length,sha256:crypto.createHash("sha256").update(h).digest("hex"),fetchedAt:new Date().toISOString(),fetchMode:"http-fetch-no-js"});
      pages.push({url:l.url,text:clean(h)});
    }catch(e){ manifest.push({url:l.url,error:String(e.message??e)}); }
  }
  fs.writeFileSync(path.join(dir,"manifest.json"),JSON.stringify(manifest,null,1));
  let all="";
  for(const p of pages){ all += `\n\n===== ${p.url} =====\n` + p.text; }
  const numbered = all.split("\n").map((l,i)=>`${String(i+1).padStart(5)}| ${l}`).join("\n");
  fs.writeFileSync(path.join(dir,"page-text.txt"),numbered);
  // 자유수영 문맥 추출
  const lines = all.split("\n");
  const hits=[];
  lines.forEach((ln,i)=>{
    if(/자유\s*수영/.test(ln)){
      const from=Math.max(0,i-5), to=Math.min(lines.length,i+25);
      const win=lines.slice(from,to);
      const times=[...win.join("\n").matchAll(TIME)].map(m=>`${m[1]}~${m[2]}`.replace(/\s/g,""));
      hits.push({line:i+1,heading:ln.slice(0,80),times:[...new Set(times)],window:win.map((l,j)=>`${from+j+1}| ${l}`).join("\n")});
    }
  });
  fs.writeFileSync(path.join(dir,"freeswim-hits.json"),JSON.stringify(hits,null,1));
  const r={slug:t.slug,name:t.name,homepage:t.homepage,pages:pages.length,okPages:manifest.filter(m=>m.status===200).length,freeswim_mentions:hits.length,any_times:hits.some(h=>h.times.length>0),dir};
  results.push(r);
  console.log(`${r.freeswim_mentions>0?(r.any_times?'시간발견':'언급만'):'언급없음'} | ${t.name} | 페이지 ${r.okPages}/${manifest.length} | 자유수영 ${hits.length}건`);
}
let cur=0;
await Promise.all(Array.from({length:CONCURRENCY},async()=>{ while(cur<targets.length){ const t=targets[cur++]; await work(t); }}));
fs.writeFileSync(path.join(OUT,`summary-${TODAY}.json`),JSON.stringify(results,null,1));
