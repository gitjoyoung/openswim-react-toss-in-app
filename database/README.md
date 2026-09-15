# database

런타임 데이터베이스는 **Neon Postgres**다. 앱은 Neon Data API/Auth로 익명 토큰을 받아 조회하고
(`src/pool.ts`), 원격 조회가 실패하면 번들 JSON으로 폴백한다.

```
database/
  migrations/         현재 Neon 스키마 변경. 여기에 추가한다.
  legacy-supabase/    Neon 이관 전 Supabase 시절 기록. 실행하지 않는다.
```

## migrations/

Neon에 적용하는 SQL이다. 파일명은 `YYYYMMDDHHMMSS_설명.sql`.

적용은 `psql` 또는 `NEON_DATABASE_URL`을 쓰는 스크립트로 직접 한다. 자동 실행기는 두지 않았다.
프로덕션 DB라 적용 전에 내용을 눈으로 확인하고 승인받는 절차를 거친다.

```bash
set -a; source .env; set +a
psql "$NEON_DATABASE_URL" -f database/migrations/<파일>.sql
```

새 테이블을 만들면 Neon Data API(PostgREST)의 스키마 캐시를 한 번 깨워야 한다.
안 하면 `PGRST205 Could not find the table ... in the schema cache` 로 조회가 실패한다.

```sql
notify pgrst, 'reload schema';
```

권한 패턴은 `public.pools`를 따른다. RLS를 켜고 `anonymous` 역할에 `select`만 준다.
쓰기는 `neondb_owner`(동기화 스크립트)만 한다. 역할 이름은 `anon`이 아니라 `anonymous`다.

## legacy-supabase/

Neon으로 옮기기 전 Supabase에서 쓰던 로컬 설정(`config.toml`)과 SQL 이력이다.

- 런타임·배포·데이터 운영 어디에서도 참조하지 않는다.
- 당시 프로젝트를 재현하거나 이력을 감사할 때만 본다.
- **여기 있는 SQL을 Neon에 그대로 실행하지 않는다.** 역할 이름과 스키마가 다르다.
- 새 변경은 `database/migrations/`에 쓴다.

## 화면 문구 바꾸기 (`public.app_texts`)

수영장 상세 시간표 아래 근거 문구는 번들이 아니라 이 테이블에 있다. **update 하면 재배포 없이 반영된다.**

| key | 쓰이는 곳 |
| --- | --- |
| `pool_notice_verified` | 첫 줄. 확인 날짜가 있는 수영장 |
| `pool_notice_unverified` | 첫 줄. 확인 날짜가 없는 수영장 |
| `pool_notice_caution` | 둘째 줄. 공식 페이지에서 확인하지 못한 수영장 |

문장 안에서 쓸 수 있는 것:

| 표기 | 뜻 |
| --- | --- |
| `{date}` | `pools.free_swim_verified_at` |
| `{source}` | `pools.free_swim_source` |
| `[글자](주소)` | 링크. 주소 자리에 `{source}` 를 쓴다 |

```
[해당 수영장 정보]({source})를 {date} 확인하였습니다.
```

```sql
update public.app_texts set value = '...', updated_at = now() where key = 'pool_notice_caution';
```

주의할 점:

- 근거 URL 이 없는 수영장은 `{source}` 가 빈 문자열이 되고 링크 없이 글자만 나간다. `http(s)` 가 아닌 주소는 링크로 만들지 않는다.
- 마크다운은 인라인 링크만 처리한다. 볼드·리스트는 그냥 글자로 나온다.
- 어떤 문장을 쓸지(확인 날짜 유무)와 주의 문장을 붙일지는 `pools`의 `free_swim_*` 값이 정한다. 문구만 여기서 관리한다.
- 행을 지우거나 비워도 앱은 번들에 박힌 기본 문구(`src/appText.ts`)로 폴백한다. 화면이 비지는 않는다.
- 문구를 바꿔도 **이미 앱을 켜 둔 사용자는 다음 실행부터** 바뀜 문구를 본다. 조회를 앱 시작 시 한 번만 하고 캐시하기 때문이다.

새 테이블을 만든 직후에는 `notify pgrst, 'reload schema'`를 해도 PostgREST 캐시 전파에 몇 분 걸릴 수 있다.
실제로 2026-09-09 적용 직후 일부 요청이 `PGRST205`로 404를 낸 뒤 몇 분 뒤에 정상화됐다. 바로 404가 나와도 재시도해 본다.

## 수영장 이용 제한 표시 (`pools.access_label` / `access_note`)

여성 전용, 어린이 입장 불가, 일부 시간 회원 전용처럼 **이용 대상 제한**을 알린다.
상세 화면에서 수영장 이름 바로 아래 줄로 나간다.
시설 섹션은 화면 끝이라 헛걸음을 막기에 늦어서 위로 뺐다.
목록 카드에는 넣지 않는다. 한 줄에 이름·요일·거리가 이미 들어가 있다.

```sql
update public.pools
   set access_label = '여성 전용',
       access_note  = '남성은 이용할 수 없습니다.'
 where id = '...';
```

**무엇을 넣는가** — 이 앱은 비회원이 오늘 가서 자유수영을 할 수 있는지를 본다.
따라서 **신분 때문에 입장이 막히는 경우만** 넣는다. (여성 전용, 특정 연령 입장 불가, 장애인 전용)

넣지 않는 것:

| 유형 | 이유 |
| --- | --- |
| 회원 전용 시간대 | 우리 데이터가 애초에 비회원 일일권 기준이다 |
| 특정 요일만 자유수영 | `free_swim` 시간표가 이미 그대로 보여준다 |
| 방역·수질정화 등 시간대 운영 | 사람 기준 제한이 아니다 |
| 성인·청소년 요금이 나뉘어 있음 | 요금표가 이미 보여준다 |

- `access_label` 은 **배지에 들어가므로 짧게** 쓴다.
- `access_note` 는 상세에서 배지 옆에 붙는 한 줄 설명이다. 비워도 된다.
- 둘 다 자유 텍스트다. 분류를 코드에 두지 않았으므로 **새 유형이 생겨도 배포가 필요 없다.**
- 확인되지 않은 수영장은 비워 둔다. 값이 없으면 화면에 아무것도 안 나온다. 틀린 배지보다 없는 게 낫다.
- 제한을 지우려면 `set access_label = null` 로 되돌린다.

## 컬럼을 추가한 뒤 앱에 안 나올 때

`select=*` 로 조회하면 컬럼을 추가하고 `notify pgrst, 'reload schema'` 를 보내도
PostgREST 응답에 새 컬럼이 한동안 나오지 않는다. 2026-09-10 `access_label` 추가 때
명시 컬럼 조회(`select=name,access_label`)는 즉시 200이 나왔는데,
`select=*` 는 2분 넘게 예전 컬럼 목록만 돌려줬다. HTTP 캐시 헤더는 없었다.

그래서 앱(`src/pool.ts`)은 `select=*` 대신 컬럼을 나열해 요청한다.
**새 컬럼을 화면에 쓰려면 `POOL_COLUMNS` 에도 추가해야 한다.**

## 데이터 동기화 스크립트

- `scripts/insert-new-pools.mjs` — 신규 시설을 `public.pools` 에 INSERT (중복 방어선 포함, 트랜잭션)
- `scripts/cleanup-db.mjs` — 중복 병합·형식 정규화 (dry-run 후 `--write`)
- `scripts/sync-gear.mjs` — `public.gear_items`의 쉐어링크 URL을 따라가 상품명·이미지를 채우고 폴백 JSON을 갱신
