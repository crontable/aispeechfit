# DB 변경 절차

Supabase 프로젝트의 권한·정책을 바꿀 때 밟는 순서다. 이 저장소는 supabase CLI를 프로젝트에 연결(`supabase link`)하지 않았으므로 SQL은 대시보드 SQL Editor에서 실행한다. CLI는 타입 생성에만 쓴다. 정책의 뜻은 `docs/SECURITY.md`에 있다. 이슈 #32의 실제 적용은 9번에서 대상·백업·영향·복원을 정한 뒤 10번에서 수행한다. 현재 구현 검증 단계에서 운영 SQL을 실행하지 않는다.

## 파일 위치

| 경로 | 역할 |
| --- | --- |
| `supabase/migrations/<timestamp>_<name>.sql` | 적용할 변경. 트랜잭션으로 감싸고 여러 번 실행해도 결과가 같게 쓴다 |
| `supabase/operations/retire-phone-access.sql` | 이슈 #32의 새 인증 배포 후 수동 권한 회수. 데이터 폐기와 별도이며 자동 적용하지 않는다 |
| `supabase/rollback/<timestamp>_<name>.sql` | 같은 timestamp의 마이그레이션을 적용 전 상태로 되돌리는 SQL |
| `supabase/verification/access-policy.sql` | 적용 전후에 실행하는 읽기 전용 확인 질의. 기대 결과를 주석에 적는다 |
| `supabase/verification/access-policy.test.mjs` | 8번에서 Better Auth 서명 토큰 명세에 맞춰 합성 데이터 환경의 HTTP 검사로 개편한다 |
| `supabase/functions/_shared/database.types.ts` | CLI가 `public` 스키마에서 생성한 TypeScript 타입. 손으로 고치지 않는다 |
| `domain/database.types.ts` | 위 파일을 Next.js 쪽 경로로 다시 내보내는 파일 |

## 적용 순서

1. **현황 기록.** `supabase/verification/access-policy.sql`을 실행해 결과를 보관한다. 이 결과가 복원 파일의 기준이다.
2. **백업.** 대시보드 Database → Backups에서 최신 백업 시각을 확인한다. 사용 중인 프로젝트의 실제 백업·복원 가능 범위를 확인한다. 행 변경은 FK·열·정밀도와 함께 복원 가능한 비공개 백업을 확보한다. 권한·정책만 바꾸는 경우에도 현재 정의·역할·열 권한을 저장한다.
3. **복원 파일 작성.** 1번 결과를 그대로 되살리는 SQL을 `supabase/rollback/`에 둔다. 이름만 보고 정책을 지우지 않고 정의 전체를 옮긴다.
4. **검증 환경 실행.** 운영과 분리한 Supabase 프로젝트가 있으면 같은 스키마와 합성 데이터에 먼저 적용하고 5·6번을 거친다. 이슈 #32는 합성 자료를 넣은 격리 DB에서 먼저 검증한다. 실제 Data API HTTP 검증 환경이 없으면 그 검사는 미실행으로 기록하고 9번에서 대상과 영향을 먼저 확인한다.
5. **운영 적용.** SQL Editor에 마이그레이션 파일 전체를 붙여 한 번에 실행한다. 트랜잭션이라 중간 실패 시 아무것도 바뀌지 않는다. 실행 시각과 실행한 사람을 이슈에 적는다.
6. **확인.**
   - `supabase/verification/access-policy.sql`을 다시 실행해 주석의 기대 결과와 맞춘다.
   - 8번에서 합성 데이터 환경의 실제 HTTP 검사를 수행한다. 운영 적용 후 확인할 실계정·읽기 범위는 9번에서 정하며 거부 예상 쓰기를 운영에 실행하지 않는다.
   - 유효 이용권 계정으로 로그인해 `/study`와 챕터 화면이 뜨는지, 이용권 없는 계정으로 `/unauthorized`가 뜨는지 본다.
   - 대시보드 Advisors → Security의 경고를 적용 전과 비교한다.
7. **복원.** 정상 요청이 막히면 원인을 자격(토큰 전달)·권한(GRANT)·정책(RLS) 순서로 가른다. 원인을 못 찾으면 복원 파일을 실행해 1번 상태로 돌아간다. RLS 일괄 해제나 `grant all`로 복구하지 않는다.
8. **기록.** 적용 전후 확인 결과를 이슈에 적는다. 키·토큰·사용자 ID·이메일은 뺀다.
9. **타입 재생성.** 테이블·열·함수를 바꾼 마이그레이션이면 아래 "타입 생성" 절의 명령을 실행해 생성 파일을 같은 PR에 커밋한다.

## 타입 생성

`supabase/functions/_shared/database.types.ts`는 Supabase CLI가 `public` 스키마에서 생성한다. Edge Function(`supabase/functions/_shared/runtime.ts`)과 Next.js의 공통 서비스 타입이 이 파일의 `Database` 타입을 쓰고, `domain/types.ts`의 `BookDTO`·`ChapterDTO`·`QuestionDTO`도 이 파일의 행 타입에 별칭을 붙인 것이다. 그래서 코드가 DB에 없는 열을 읽으면 `tsc`와 `deno check`가 실패한다.

생성 파일을 `domain/`이 아니라 `supabase/functions/_shared/`에 두는 이유는 Edge Function 배포가 `supabase/functions` 아래 파일만 올리기 때문이다. Next.js 쪽은 `domain/database.types.ts`가 그 파일을 다시 내보낸다.

1. CLI를 설치한다. `brew install supabase/tap/supabase`
2. `.env.local`의 `SUPABASE_ACCESS_TOKEN`을 셸에 싣고 생성한다. `<ref>`는 `NEXT_PUBLIC_SUPABASE_URL`의 서브도메인이다.
   ```sh
   export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)
   supabase gen types typescript --project-id <ref> --schema public > supabase/functions/_shared/database.types.ts
   ```
3. 검사한다. 어긋난 자리가 있으면 코드를 고친다. 생성 파일은 고치지 않는다.
   ```sh
   pnpm exec tsc --noEmit
   (cd supabase/functions/service-auth-v1 && deno check index.ts)
   ```
4. 생성 파일을 마이그레이션과 같은 PR에 커밋한다.

`pnpm build`는 `tsconfig.json`이 `supabase/functions`를 제외하므로 Edge Function 코드를 검사하지 않는다. 학습 자료를 실제로 조회하는 코드는 Edge Function에 있으므로 `deno check`를 빼면 어긋남을 못 잡는다.

## 재구축

빈 프로젝트 재구축에서는 초기 public 스키마와 인증 스키마·역할·접근 정책의 실제 의존 순서를 먼저 검토한다. 기존 마이그레이션에는 전화번호와 선택 이용권 전환의 과거 절차가 포함되어 있으므로 현행 운영 DB에서 파일 전체를 timestamp 순서로 재실행하지 않는다. 백업에서 복구한 뒤에도 `supabase/verification/access-policy.sql`로 권한·정책이 마이그레이션과 같은지 확인한다. 백업은 데이터와 함께 정책도 되살리지만, 복구 시점이 마이그레이션 적용 전이면 정책이 옛 상태다.

## 이력

| 날짜 | 마이그레이션 | 내용 |
| --- | --- | --- |
| 2026. 09. 12. | `20260912000000_protect_learning_data.sql` | `anon` 권한 회수, 일반 사용자 쓰기 차단, 유효 이용권 기준 학습 자료 SELECT 정책, `public` 기본 권한 회수. 이슈 #26 |
| 2026. 09. 13. | (마이그레이션 없음) | `public` 스키마에서 TypeScript 타입을 처음 생성해 커밋. 이슈 #27 |

이슈 #32의 7번 수동 SQL은 정책·GRANT·역할만 회수하며 public 열·함수 형식은 바꾸지 않는다. public 타입은 격리 DB에서 CLI로 생성한 결과를 비교하며 수동으로 고치지 않는다. 개인정보 자료·식별 관계와 운영 정리 순서는 [운영 정리 명세](./PHONE-REMOVAL-OPERATIONS.md)를 따른다.
