# 증거 수집이 왜 그렇게 됐나 — 원인 분석 (2026-09-10)

"스크린샷 0건 / 증거번들 커버리지 37% / 오늘 등록한 14곳 중 6곳 번들 없음" 상태의 원인을
추측이 아니라 git 이력·코드·실제 재현으로 확인한 기록. 모든 항목에 재현 명령을 붙였다.

---

## 원인 1. 스킬 명세와 구현이 처음부터 어긋났고, 이를 잡아줄 장치가 없었다

`SKILL.md` 2절은 증거번들에 `screenshot-full.png`를 필수로 적어놨다. 그런데 수집기는
스크린샷을 한 번도 찍은 적이 없다.

git 이력상 순서가 원인을 그대로 보여준다. 전부 같은 날(2026-09-02)이다.

| 시각 | 커밋 | 내용 |
|---|---|---|
| 02:07 | `b3b2d41` | 스킬 작성 — `screenshot-full.png` 포함한 번들 명세 |
| 14:31 | `53d521c` | 수집기 작성 — 텍스트 + manifest만. HTML도 스크린샷도 없음 |
| 14:54 | `593a107` | 원본 HTML + 해시 **소급 추가** (23분 뒤) |
| 15:55 | `ce0fd89` | 브라우저 렌더링 재수집 추가. 스크린샷은 여전히 없음 |

명세가 먼저 있었는데 구현이 그걸 체크리스트로 쓰지 않았다. HTML은 나중에 빠진 걸 눈치채고
메웠지만 스크린샷은 끝내 안 메웠다. 명세 준수를 검사하는 테스트나 CI가 없어서 이 격차가
드러날 계기가 없었다.

재현:
```
git log -S "screenshot-full" --format='%h %ad %s' --date=short -- .claude/skills/korean-pool-research/SKILL.md
git log --format='%h %ad %s' --date=format:'%m-%d %H:%M' -- scripts/collect-pool-evidence.mjs
grep -l "screenshot" scripts/*.mjs   # 결과 없음
```

## 원인 2. 스크린샷을 찍을 수단이 저장소 안에 아예 없었다

이게 원인 1보다 더 근본이다. 수집기는 독립 Node 스크립트인데 이 저장소에는 브라우저
드라이버가 없다. `package.json`의 dependencies/devDependencies에 playwright도 puppeteer도
없다. `node_modules`에 puppeteer가 보이지만 `@apps-in-toss/devtools`의 전이 의존성일 뿐
우리 코드는 쓰지 않는다.

그래서 브라우저가 필요했던 작업(JS 렌더링 페이지 재수집)은 **코드가 아니라 일회성 REPL
루프**로 처리됐다. 실제로 `manifest-browser.json` / `page-text-browser.txt`를 164건이나
만들어놨는데, **그걸 만든 코드가 저장소에 존재하지 않는다.** 재실행이 불가능하고,
스크린샷을 끼워 넣을 자리도 애초에 없었다.

재현:
```
grep -rln "manifest-browser\|page-text-browser" . --include=*.mjs --exclude-dir=node_modules   # 결과 없음
ls evidence/pools/*/*/manifest-browser.json | wc -l                                            # 164
```

여기에 더해 Aside REPL의 `page.screenshot({ path })`는 세션 디렉터리 밖으로 파일을 못 쓴다
(`Path ... escapes the session directory`). 저장소 경로로 바로 저장이 안 되니 스크린샷을
증거번들에 넣으려면 버퍼로 받아 `fs.writeFile`로 직접 쓰는 우회가 필요했는데, 그 사실이
어디에도 기록돼 있지 않았다.

## 원인 3. 커버리지 37%는 "실패"가 아니라 "중간에 멈춘 것"이다

`evidence/pools`의 312개 시설 폴더는 **전부 날짜가 2026-09-02 하나뿐**이다. 그날 이후 수집을
다시 돌린 적이 없다.

수집기는 타깃 파일 + `LIMIT`(기본 40) 배치 구조다. 이어달리기는 되지만(`done` 체크로
건너뜀) "큐가 빌 때까지 돌린다"는 장치가 없어서, 사람이 그만 돌리면 그대로 멈춘다.
당시 큐는 `tmp/audit-queue.json` 585건이었고 312건에서 멈췄다.

```js
// scripts/collect-pool-evidence.mjs:123
const queue = rows.filter((r) => !done.has(r.id)).slice(0, LIMIT);
```

재현:
```
ls -d evidence/pools/*/*/ | sed 's#.*/\([0-9-]*\)/#\1#' | sort -u   # 2026-09-02 뿐
node -e 'console.log(require("./tmp/audit-queue.json").length)'      # 585
ls evidence/pools | wc -l                                           # 312
```

## 원인 4. 오늘 등록한 14곳 중 6곳에 번들이 없는 건 위임 방식 문제였다

감일·서대문·조치원·양산중앙·천성산·세종시민 6곳은 조사를 서브에이전트에 맡겼는데,
**서브에이전트에게 증거 저장 경로와 포맷을 지시하지 않았다.** 인용문이 든 JSON만 회수했고
원본 HTML도 스크린샷도 남지 않았다. 명백히 오케스트레이션 쪽 누락이다.

## 원인 5. fetch 0페이지 4건 — 원인이 서로 다르다 (전부 재현 확인)

| 시설 | 결과 | 실제 원인 |
|---|---|---|
| 아르피나 | `404` | 후보 목록(helloswim)의 `website` 값이 틀린 URL이었다. 실제 공식은 `arpina.co.kr`. 그 값을 검증 없이 수집 타깃으로 썼다 |
| 시흥시청소년수련관 | `ERR_TLS_CERT_ALTNAME_INVALID` | `www.ww.shyouth.or.kr`가 인증서 altnames에 없음. 게다가 실제 공지 페이지는 `program.shyouth.or.kr` |
| 양지수영장 | `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | 중간 인증서 미제공(체인 불완전). 브라우저는 통과하지만 Node fetch는 실패 |
| 고촌도담수영장 | `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | 위와 동일 |
| 구미시선산 | `200`인데 **292바이트** | 홈이 프레임/리다이렉트 스텁. 실제 내용은 `pages/sub.htm` 하위에 있음 |

즉 "수집 실패"로 뭉뚱그려져 있던 게 실제로는 **잘못된 타깃 URL(3건)** 과
**한국 공공기관 사이트의 불완전한 TLS 체인(2건)** 두 종류였다. 그런데 옛 수집기는 예외를
`{ url, error }` 한 줄로만 삼켜서 이 구분이 드러나지 않았다.

재현: `docs/data/worksplit/` 의 `B-evidence-targets.json` URL로 아래 실행
```js
await fetch(url).catch(e => e.cause?.code)
```

---

## 무엇을 고쳤나 (2026-09-10)

1. **`scripts/collect-evidence-v2.mjs` 신설**
   - 원본 HTML을 항상 저장 (`html/NN.html`)
   - TLS 검증 실패 시 **한 번만** 우회 재시도하고 `tlsVerified: false` + `tlsError` 코드를
     manifest에 반드시 남긴다. 조용히 넘어가지 않는다.
   - 스크린샷을 못 찍는다는 사실을 `screenshotPending: true`로 명시해 누락이 눈에 띄게 했다.
2. **등록한 14곳 전부 재수집** — 검증된 실제 출처 URL 기준. 200응답 21/21, TLS 우회 2건 기록.
3. **스크린샷 21장 확보** — REPL 브라우저에서 버퍼로 받아 저장소에 직접 기록. manifest에
   `screenshots[]`와 페이지별 `screenshot` 필드로 연결.
4. **집중 근거샷 개념 추가** — 전체 페이지 샷은 길면 7,961px라 어디에 근거가 있는지 육안
   확인이 어렵다. 운정스포츠센터는 `일일입장 자유수영` 표 구간만 잘라
   `screenshot/01-freeswim-table.png`로 따로 남겼다.

### 이 과정에서 새로 배운 함정
전체 페이지 스크린샷이 **저장됐다는 사실이 근거가 담겼다는 뜻은 아니다.** 운정 첫 시도는
파일은 정상 생성됐지만 잘라 보니 표가 아니라 배너 구간이었다. 파일 존재/용량만 확인하고
넘어갔으면 "근거 있음"으로 잘못 기록될 뻔했다. 이미지 근거는 반드시 해당 사실이 보이는지
눈으로 확인해야 한다 — 스킬 4절이 시설 사진에 대해 말한 것과 같은 원칙이 페이지
스크린샷에도 똑같이 적용된다.

## 아직 안 고친 것

- **기존 831행 쪽 커버리지 312/845는 그대로다.** v2 수집기로 나머지를 돌리는 건 개선(A)
  세션 몫이다.
- **브라우저 수집이 여전히 코드가 아니다.** 근본 해결은 playwright를 devDependency로 넣어
  `scripts/`에서 헤드리스로 돌리는 것이다. 지금은 REPL에서 사람이 돌려야 재현된다.
- **명세 준수 검사가 없다.** 번들에 `html/`, `page-text.txt`, `manifest.json`,
  `screenshot/`이 다 있는지 확인하는 검증 스크립트가 있으면 원인 1이 재발하지 않는다.
