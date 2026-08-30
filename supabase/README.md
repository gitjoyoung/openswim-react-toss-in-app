# Supabase 이력 보관소

이 디렉터리는 Neon으로 이전하기 전 Supabase에서 사용하던 로컬 설정과 SQL 마이그레이션을 보관한다.

- 현재 런타임은 Neon Postgres + Neon Data API/Auth다.
- 현재 앱 코드, 배포, 데이터 동기화는 이 디렉터리를 참조하지 않는다.
- 새 스키마 변경은 Neon 데이터베이스에 적용하고 `scripts/sync-pools-to-neon.mjs`를 사용한다.
- 이력 SQL은 당시 Supabase 프로젝트의 재현·감사 목적이므로 임의로 Neon 마이그레이션으로 실행하지 않는다.

현재 스택의 환경변수와 실행 방법은 루트 `README.md`와 `.env.example`을 기준으로 한다.
