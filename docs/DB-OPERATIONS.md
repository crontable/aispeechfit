# DB 변경 절차

Supabase 프로젝트의 권한·정책을 바꿀 때 밟는 순서다. 이 저장소에는 supabase CLI 연결이 없으므로 SQL은 대시보드 SQL Editor에서 실행한다. 정책의 뜻은 `docs/SECURITY.md`에 있다.

## 파일 위치

| 경로 | 역할 |
| --- | --- |
| `supabase/migrations/<timestamp>_<name>.sql` | 적용할 변경. 트랜잭션으로 감싸고 여러 번 실행해도 결과가 같게 쓴다 |
| `supabase/rollback/<timestamp>_<name>.sql` | 같은 timestamp의 마이그레이션을 적용 전 상태로 되돌리는 SQL |
| `supabase/verification/access-policy.sql` | 적용 전후에 실행하는 읽기 전용 확인 질의. 기대 결과를 주석에 적는다 |
| `supabase/verification/access-policy.test.mjs` | 앱을 거치지 않고 Data API에 직접 요청해 허용 범위를 검증하는 테스트 |

## 적용 순서

1. **현황 기록.** `supabase/verification/access-policy.sql`을 실행해 결과를 보관한다. 이 결과가 복원 파일의 기준이다.
2. **백업.** 대시보드 Database → Backups에서 최신 백업 시각을 확인한다. 무료 요금제는 일 단위 백업만 있으므로, 데이터 행을 바꾸는 변경이면 대상 테이블을 CSV로 내려받는다. 권한·정책만 바꾸는 변경은 1번 결과가 백업이다.
3. **복원 파일 작성.** 1번 결과를 그대로 되살리는 SQL을 `supabase/rollback/`에 둔다. 이름만 보고 정책을 지우지 않고 정의 전체를 옮긴다.
4. **검증 환경 실행.** 운영과 분리한 Supabase 프로젝트가 있으면 같은 스키마와 합성 데이터에 먼저 적용하고 5·6번을 거친다. 없으면 운영에 바로 적용하되 6번을 곧바로 한다.
5. **운영 적용.** SQL Editor에 마이그레이션 파일 전체를 붙여 한 번에 실행한다. 트랜잭션이라 중간 실패 시 아무것도 바뀌지 않는다. 실행 시각과 실행한 사람을 이슈에 적는다.
6. **확인.**
   - `supabase/verification/access-policy.sql`을 다시 실행해 주석의 기대 결과와 맞춘다.
   - `supabase/verification/access-policy.test.mjs`를 실행한다. 실행 방법은 파일 머리말에 있다.
   - 유효 이용권 계정으로 로그인해 `/study`와 챕터 화면이 뜨는지, 이용권 없는 계정으로 `/unauthorized`가 뜨는지 본다.
   - 대시보드 Advisors → Security의 경고를 적용 전과 비교한다.
7. **복원.** 정상 요청이 막히면 원인을 자격(토큰 전달)·권한(GRANT)·정책(RLS) 순서로 가른다. 원인을 못 찾으면 복원 파일을 실행해 1번 상태로 돌아간다. RLS 일괄 해제나 `grant all`로 복구하지 않는다.
8. **기록.** 적용 전후 확인 결과를 이슈에 적는다. 키·토큰·사용자 ID·이메일은 뺀다.

## 재구축

빈 프로젝트에 스키마를 다시 만들 때는 테이블 생성 SQL 뒤에 `supabase/migrations/`의 파일을 timestamp 순서로 실행한다. 백업에서 복구한 뒤에도 `supabase/verification/access-policy.sql`로 권한·정책이 마이그레이션과 같은지 확인한다. 백업은 데이터와 함께 정책도 되살리지만, 복구 시점이 마이그레이션 적용 전이면 정책이 옛 상태다.

## 이력

| 날짜 | 마이그레이션 | 내용 |
| --- | --- | --- |
| 2026. 09. 12. | `20260912000000_protect_learning_data.sql` | `anon` 권한 회수, 일반 사용자 쓰기 차단, 유효 이용권 기준 학습 자료 SELECT 정책, `public` 기본 권한 회수. 이슈 #26 |
