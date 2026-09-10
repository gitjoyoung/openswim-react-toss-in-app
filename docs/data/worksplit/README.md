# 수영장 데이터 작업 분리 (2026-09-10 기준)

라이브 Neon `public.pools` 831행 감사 + 외부 디렉터리 3곳(helloswim 993 / swimmingis 691 /
oneul-swim 82) 대조 결과를 두 갈래 작업으로 나눈다.

- **세션 A — 개선**: 이미 DB에 있는 831행의 품질을 고친다.
- **세션 B — 신규**: DB에 없는 시설을 조사해서 새 행으로 넣는다.

두 세션은 같은 테이블을 쓰므로 아래 경계를 반드시 지킨다.

## 충돌 방지 경계 (양쪽 공통, 위반 금지)

| | 세션 A (개선) | 세션 B (신규) |
|---|---|---|
| 허용 SQL | `UPDATE ... WHERE id = <기존 id>` 만 | `INSERT` 만 |
| 금지 | `INSERT`, `DELETE`, 신규 시설 조사 | 기존 행의 어떤 컬럼도 수정 금지 |
| 대상 id | `worksplit/A*.json` 에 실린 id | 신규 UUID (기존 id와 절대 겹치지 않음) |
| 작업 파일 | `worksplit/A*.json`, `progress-A.jsonl` | `worksplit/B*.json`, `progress-B.jsonl` |

- B 세션이 조사 중 "이건 이미 DB에 있는 시설이었다"를 발견하면 **직접 고치지 말고**
  `worksplit/handoff-B-to-A.jsonl` 에 한 줄 append 하고 넘어간다.
- A 세션이 "이 시설의 분점/신규 시설이 더 있다"를 발견하면 **직접 넣지 말고**
  `worksplit/handoff-A-to-B.jsonl` 에 append 한다.
- 동시에 돌리지 말 것. 한 번에 한 세션만. (병렬 브라우저/프로세스는 이 머신에서 렉을 유발)

## 작업 전 필독

- `Openswim/AGENTS.md`
- `Openswim/.claude/skills/korean-pool-research/SKILL.md`

핵심 원칙(요약, 원문이 우선):
- 공식 홈페이지 / 지자체·운영사 공식 페이지만 출처로 인정. 블로그·카페는 단독 근거 불가.
- 근거 페이지를 먼저 날짜와 함께 저장하고 나서 값을 뽑는다.
- 추측한 시간표는 절대 쓰지 않는다. 모르면 `공개 자료 없음` / `전화 확인 필요`로 명시.
- 시설 운영시간과 자유수영 시간은 별개다. 강습 시간표를 자유수영으로 옮겨 적지 않는다.
- 한국어 시간범위 정규식에는 전각 물결(～ ∼ 〜)을 반드시 포함한다.
- fetch만으로 "자료 없음"은 결론이 아니라 미확인이다. 브라우저 렌더링으로 재수집한다.
- 자동 대조에서 뜬 conflict는 "출처를 다시 읽으라는 신호"이지 값을 덮어쓸 권한이 아니다.
- Neon 프로덕션 행 변경 전 승인 필요.

## 파일 목록

### 세션 A 입력
| 파일 | 건수 | 내용 |
|---|---|---|
| `A1-long-session-suspects.json` | 429 | 단일 자유수영 세션이 5시간 이상. 운영시간 오입력 의심. confidence 낮은 순 정렬(needs_check 124 / low 191 / medium 110 / high 4) |
| `A2-unverified-provenance.json` | 297 | `free_swim_confidence` 가 `needs_check` 또는 NULL |
| `A3-missing-price.json` | 32 | `price_free_swim` 없음 |
| `A4-no-contact.json` | 93 | 홈페이지·전화 둘 다 없음 |
| `A5-schedule-not-found.json` | 4 | 자유수영은 하는데 시간표를 못 찾은 잔여 백로그 |

### 세션 B 입력
| 파일 | 건수 | 내용 |
|---|---|---|
| `B1-new-public-candidates.json` | 25 + 6 | `confirmed`: DB 미보유 확인된 공공시설 25곳 / `scope_check`: 수록 대상인지부터 판단할 6곳 |

## 감사 재생성

```
cd Openswim && set -a; source .env; set +a
node ../../.aside/.../split.mjs   # 세션마다 다시 만들 것 없이 아래 방식으로 재생성
```
세션 종료 시점에 목록을 갱신하려면 `scripts/audit-pool-data.mjs`,
`scripts/report-pool-data-coverage.mjs` 를 다시 돌리고 이 폴더의 JSON을 재생성한다.
