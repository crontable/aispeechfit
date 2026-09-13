# 이슈 32 S3 구현 명세와 검증 절차

## 범위와 적용 기준

S3는 학습 자료 접근을 실제 Better Auth 세션과 본인 유효 이용권으로 제한하고, 외부 제공자 회원 식별자를 저장하는 `better_auth.accounts.account_id(text)`의 이름을 `provider_account_id`로 정정한다. D1 이름은 2026년 9월 13일 사용자가 확정했다. 내부 `accounts.id(uuid)`와 이를 참조하는 `kakao_identities.account_id(uuid)`는 유지한다. 식별값·소유권·유효 기간·학습 자료를 복사하거나 다시 만들지 않는다.

변경은 기존 스키마에 적용하는 두 개의 신규 마이그레이션이다. `20260913040000_phone_free_access.sql`은 접근 함수와 RLS 참조를 바꾸고, `20260913050000_rename_provider_account_id.sql`은 열 이름만 정정한다. 기존 마이그레이션 이력은 수정하지 않는다. 전화번호 데이터와 확인 테이블의 폐기는 D4 확인 및 S9에서 다룬다. OAuth 범위·Edge 응답·화면에서 전화번호 절차를 없애는 작업은 후속 S4~S6에 속한다.

## 세션과 이용권의 판정

Data API가 JWT 서명과 JWT 만료를 검증한 후 SQL 정책이 `iss=aispeechfit-better-auth`, `role=authenticated`, `sub`, `session_id`와 실제 `better_auth.sessions`의 사용자·세션 ID·만료를 대조한다. 세션은 `expires_at > now()`일 때 유효하며 삭제된 세션은 곧바로 거부한다. JWT를 만들어 SQL 설정에 주입하는 로컬 검사는 Data API의 암호학적 서명 검증을 대신하지 않는다. 실제 HTTP 경계는 S7·S8 검증 대상이다.

`has_valid_auth_session()`에는 인자가 없다. `has_active_ticket()`은 유효 세션에 더해 `user_id=auth.uid()`, `is_active=true`, `started_at <= now() <= expires_at`인 본인 이용권을 요구한다. 이용권 양 끝 시각은 포함하고 세션 만료 시각은 제외한다. 본인 이용권 조회 정책과 학습 자료의 이용권 정책은 유지하며, 세션 정책은 `RESTRICTIVE`로 결합한다. 학습 자료 조회에 전화번호·확인 상태·확인 버전·확인 행 존재 여부를 사용하지 않는다.

기본 인자가 있는 이전 boolean 함수와 새 무인자 함수를 함께 두면 `42725` 모호성 오류가 발생한다. 040000은 새 함수 생성 후 이전 함수를 트랜잭션 안에서 임시 이름으로 옮기고, public 4개 테이블 및 `auth_source.tickets`의 참조를 교체한 뒤 이전 함수를 `RESTRICT`로 제거한다. 예상하지 못한 의존성이 남으면 전체 트랜잭션이 실패한다. 보관 테이블의 자료와 접근 권한은 유지한다. RLS 해제와 `DROP CASCADE`를 사용하지 않는다.

## 이름 정정과 앱 연결

050000은 정확히 기존 열 하나 또는 정정된 열 하나가 존재하고 해당 열이 `text NOT NULL`인지 검사한다. 양쪽 열이 함께 있거나 모두 없으면 `ISSUE32_ACCOUNT_COLUMN_STATE_CONFLICT`, 자료형이 다르면 `ISSUE32_ACCOUNT_COLUMN_TYPE_MISMATCH`로 중단한다. 정상 재실행은 동일 상태로 끝난다. PostgreSQL의 열 이름 정정은 열의 내부 번호 및 이를 참조하는 인덱스·유일성 제약·복합 외래 키를 보존하므로 제약과 인덱스를 재생성하지 않는다. `accounts_provider_subject_key`와 `accounts_identity_binding_key`의 이름도 의미상 유효하므로 유지한다.

공통 Better Auth 매핑의 `fields.accountId`, 제공자 계정 직접 조회, 로컬 증거 수집 SQL을 새 이름으로 연결했다. 로컬 스키마 초기화 명령도 기본 스키마 생성 후 050000을 적용한다. 과거 마이그레이션과 과거 이용권 이전 검사의 `account_id`는 당시 스키마를 재현하는 용도로 남긴다.

## 격리 DB 검증 방법

1. `.env.local`의 `AUTH_MIGRATION_DATABASE_URL`이 `localhost` 또는 `127.0.0.1`, 포트 `55433`, DB `auth_migration`을 가리키는지 확인한다. `pnpm auth-migration:db`로 별도 PostgreSQL 컨테이너를 준비한다. 이 문서의 S3 검증에 운영 적용 명령을 사용하지 않는다.
2. `pnpm test:service-auth`를 실행한다. 접근 검사는 임시 DB에 기존 인증 스키마·기존 접근 정책·운영에서 관측한 public 열과 외래 키·보관 이용권 구조를 만들고 합성 자료를 넣은 다음 S3를 적용한다. 임시 DB와 이 검사에서 생성한 역할은 종료 시 정리한다.
3. 검사에서 변경 전후 전체 행, 계정·사용자 ID, 이용권 소유자·날짜·상태, 학습 자료, 시퀀스, RLS·테이블 권한 및 외래 키 객체를 비교한다. 전화번호 없는 계정의 허용, 전화번호 상태 무관성, 잘못된 issuer/role/세션 연결, 만료·삭제 세션, 타인·미보유·만료·미개시·비활성 이용권, 경계 시각, 일반 역할 쓰기 및 보관 자료 접근 거부를 확인한다.
4. 예상하지 못한 함수 의존성과 이름 충돌을 넣어 실패 후 기존 상태가 보존되는지 확인한다. 정상 재실행, 역순 롤백, 롤백 재실행, 재적용을 검증한다. `supabase/verification/phone-free-access.sql`은 읽기 전용 메타데이터·집계 검사이며 첫 결과의 모든 항목이 참이어야 한다.
5. `pnpm test:auth-schema`로 새 매핑에 대해 Better Auth의 스키마 비교·회원 생성·로그인·복합 외래 키를 검사한다. 가상 카카오 OAuth 응답을 사용하는 검사에서는 변경 전 열에 저장된 기존 계정으로 로그인한 후 사용자와 계정 UUID가 유지되는지 확인한다.
6. `pnpm test:edge-auth`, `pnpm exec tsc --noEmit`, `pnpm lint`를 실행한다. public 타입은 마이그레이션을 적용한 격리 DB에서 `supabase gen types typescript --db-url <격리 DB URL> --schema public`으로 재생성한다. 비밀번호를 로그에 남기지 않고, 생성 파일을 손으로 수정하지 않는다. Edge 함수는 `deno check --config supabase/functions/service-auth-v1/deno.json supabase/functions/service-auth-v1/index.ts`로 확인한다.

S3의 CLI 생성 결과는 기존 public 테이블·관계 타입을 그대로 유지하고 세션 함수 인자를 `never`로 바꾼다. 이번 `--db-url` 생성 결과에는 기존 `__InternalSupabase.PostgrestVersion` 항목이 출력되지 않았다. 생성 결과를 그대로 저장하고 Next.js 및 Edge 양쪽 타입 검사로 사용 지점을 검증한다.

## 배포 호환성과 복원

| Edge 버전 | DB 열 이름 | 결과와 조치 |
| --- | --- | --- |
| 이전 매핑 | `account_id` | 기존 동작을 유지한다. |
| 이전 매핑 | `provider_account_id` | 계정 SQL이 기존 열을 찾지 못한다. 혼합 배포를 허용하지 않는다. |
| 정정된 매핑 | `account_id` | 계정 SQL이 새 열을 찾지 못한다. 혼합 배포를 허용하지 않는다. |
| 정정된 매핑 | `provider_account_id` | S3 매핑이 일치한다. 전화번호 절차 전체 제거는 후속 단계 완료 후 검증한다. |

S8에서 변경 대상·백업·적용자·시각·트래픽 정지 및 재개 방법을 확정하고, 인증·학습 요청이 유입되지 않는 전환 구간에서 040000→050000과 해당 Edge 배포를 완료해야 한다. 트래픽을 재개하기 전에 읽기 전용 SQL, 로그인 및 허용·거부 동작을 확인한다. DB와 Edge가 서로 다른 매핑을 쓰는 상태에서 요청을 재개하지 않는다. S3는 이 배포를 실행하지 않는다.

복원은 트래픽을 제한한 상태에서 같은 timestamp의 rollback 파일을 050000→040000 순서로 실행하고 이전 Edge 릴리스를 맞춘 뒤 검사한다. 050000 복원은 이름만 되돌리고, 040000 복원은 S1에서 관측한 기존 함수 정의와 public·보관 테이블 정책을 복원한다. 이 복원은 기존 전화번호·확인 자료가 보존되어 있을 때의 절차다. S9 폐기 이후에는 삭제된 자료를 되살리지 못하므로 이 복원 절차를 그대로 적용할 수 없다.
