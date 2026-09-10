# 세션 A 시작 프롬프트 — 기존 데이터 개선

아래 블록을 새 세션에 그대로 붙여넣는다.

---

Openswim 수영장 DB의 **기존 행 품질 개선** 작업이다. 신규 시설 조사는 이 세션의 범위가 아니다.

작업 시작 전에 반드시 읽어라:
- `/Users/home/swimpool/Openswim/AGENTS.md`
- `/Users/home/swimpool/Openswim/.claude/skills/korean-pool-research/SKILL.md`
- `/Users/home/swimpool/Openswim/docs/data/worksplit/README.md` (충돌 방지 경계 포함)

## 절대 규칙

1. **`UPDATE ... WHERE id = <기존 id>` 만 허용한다.** `INSERT`/`DELETE` 금지.
   신규 시설을 발견하면 `docs/data/worksplit/handoff-A-to-B.jsonl` 에 append 하고 넘어간다.
2. **시간 값을 공식 출처의 직접 확인 없이 덮어쓰지 않는다.** 확인 못 하면 provenance 필드
   (`free_swim_source`, `free_swim_source_type`, `free_swim_verified_at`,
   `free_swim_confidence`, `free_swim_note`)만 갱신한다. 이건 이 프로젝트의 기존 정책이다.
3. **추측 금지.** 근거가 없으면 `free_swim_note` 에 `공개 자료 없음` 또는 `전화 확인 필요`를 남긴다.
4. **강습 시간표를 자유수영으로 옮겨 적지 않는다.** 시설 운영시간과 자유수영 시간은 별개다.
5. Neon 프로덕션 행을 실제로 쓰기 전에 변경 요약(대상 건수, 예시 3건 before/after)을 보고하고
   승인을 받는다. 배치 승인을 받으면 그 배치 안에서는 건별로 다시 묻지 않는다.
6. 브라우저 탭은 동시 1개만 쓰고 재사용한다. 병렬 서브에이전트로 브라우저를 여러 개 띄우지 않는다.
7. 순수 기계적 수집/변환 스크립트는 에이전트가 배치로 감독하지 말고 셸에서 직접 끝까지 돌린다.

## 우선순위

### P0 — A1 오입력 의심 429건 중 `needs_check` 124건
`docs/data/worksplit/A1-long-session-suspects.json`

단일 자유수영 세션이 5시간 이상인 건들이다. 이 프로젝트에서 이미 확인된 대표적 결함 패턴은
"시설 운영시간을 자유수영 시간으로 입력" 과 "강습 시간을 자유수영으로 입력" 두 가지다
(구로·가남체육센터수영장 사례). 값이 이미 앱에 노출되고 있어서 공백보다 사용자 피해가 크다.

각 건마다:
1. `homepage_url` 의 실제 자유수영 시간표 페이지를 찾아 근거를 저장한다 (fetch 실패 시 브라우저 렌더링).
2. 저장된 텍스트에서 시간표를 직접 읽는다. 전각 물결(～ ∼ 〜) 포함 정규식을 쓴다.
3. 세 갈래로 판정한다.
   - **오입력 확인** → 올바른 세션으로 교체 + provenance 갱신 + confidence 상향
   - **실제로 장시간 개방이 맞음** → 값 유지 + provenance 갱신 (예: 상시 개방 수영장)
   - **확인 불가** → 값 그대로 두고 `free_swim_note` 에 사유만 기록
4. 결과를 `docs/data/worksplit/progress-A.jsonl` 에 건별 1줄로 append 한다
   (`id`, `name`, `verdict`, `source_url`, `collected_at`, `changed_fields`).
   재시작 가능하게 append-only로 유지한다.

### P1 — A5 시간표 미발견 4건
`docs/data/worksplit/A5-schedule-not-found.json` — 군위국민체육센터, 공주학생수영장,
서귀포홍리실내수영장, 여수우리스포츠센터. 웹으로 안 나오면 전화 확인이 필요한 건이므로,
확인 불가로 결론 나면 사용자에게 전화 확인 대상으로 넘긴다.

### P2 — A3 요금 32건
`docs/data/worksplit/A3-missing-price.json`. 이 중 21건은 자유수영 자체를 안 하는 시설이라
요금이 없는 게 정상일 수 있다. 그런 건은 채우지 말고 사유를 기록한다.

### P3 — A4 연락처 공백 93건 / A2 미검증 297건
A4는 재검증 자체가 불가능한 상태라 연락처 확보가 선행 과제다. A2는 물량이 크므로 P0~P2를
끝낸 뒤 배치로 진행한다.

## 보고 형식

각 배치 종료 시:
- 처리 건수 / 판정 분포(오입력·정상·확인불가)
- 실제로 값이 바뀐 건수와 provenance만 바뀐 건수를 **분리해서** 보고
- 검증 수준을 명시: "출처 대조까지 확인" 인지 "스크립트 통과"인지
- 남은 건수와 다음 배치 시작 지점
