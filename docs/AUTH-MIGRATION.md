# Better Auth 신규 인증 전환 명세

## 현재 범위

2026-09-13 사용자 설명에 따르면 현재 본인만 사용하며 외부 실사용자가 없다. 사이트를 카카오톡으로 공유하고 인앱에서 편리하게 로그인하는 것이 전환의 주요 목적이다. 따라서 현재 실행 방향은 빈 `better_auth` 스키마에서 카카오 로그인으로 새 사용자를 만드는 방식이다. 기존 Supabase 사용자 전체 복사·UUID 보존·Google 계정 연결은 필수 작업에서 제외한다. 아래의 원본 매핑 및 스냅샷 절차는 이전 설계의 참고 자료이며 현재 실행 계획에 자동 적용하지 않는다.

현재 완료한 것은 개발 앱 실제 카카오 로그인·전화번호 검증, 가상 원본의 스냅샷 보관 검사, 신규 인증 스키마 생성·복원·확인 SQL과 로컬 호환성 검사다. 운영 적용, 서비스 인증 교체, 이용권 참조와 RLS 전환, 실제 모바일 카카오톡 인앱 검증은 남아 있다. `kakao:migrate`는 개발 앱 검증용 테이블 생성 명령이다. 기존 운영 사용자나 이용권은 아직 삭제하거나 변경하지 않았다.

### 신규 스키마 구현 상태

공통 매핑은 `lib/auth/schema-options.ts`, 생성 SQL은 `supabase/migrations/20260913000000_create_better_auth.sql`, 복원 SQL은 같은 파일명의 `supabase/rollback/`, 읽기 전용 확인은 `supabase/verification/better-auth-schema.sql`이다. Better Auth 1.7.4가 생성한 기본 열·자료형에 맞추고 카카오 전용 제약을 추가했다. `lib/auth/kakao.ts`의 인증 factory에 연결했고 개발 경로 `/dev/kakao`와 `/api/auth`가 새 스키마를 사용한다. 운영 서비스의 로그인·이용권 접근은 아직 전환 전이다.

`lib/auth/kakao-verification.ts`는 새 스키마의 복합 FK와 버전 제약을 따르는 전화번호 검증을 수행한다. `local-config.ts`와 `local-server.ts`는 개발 플래그·localhost·전용 DB를 제한한다. 기존 테스트 DB 세션과 별도 쿠키를 사용한다. 새 실제 카카오 가입·전화번호 저장·로그아웃·중복 없는 재로그인을 확인했다. `tests/auth-schema/kakao.test.ts`의 가상 외부 응답 검사를 더해 `pnpm test:auth-schema`는 부모 검사 포함 총 22개다.

`pnpm test:auth-schema`는 로컬 임시 데이터베이스에서 생성·반복 적용·Better Auth 스키마 차이 없음·실제 라이브러리 가입/로그인/세션 조회·계정 subject 유일성·카카오 account/user/subject 복합 참조·세션 복합 참조·번호 상태와 버전·일반 역할 접근 차단·데이터가 있을 때 복원 거부·빈 스키마 복원을 검증한다. 출력은 부모 검사 포함 10개 통과다. 이 검사에서만 합성 이메일/비밀번호 로그인을 켜며 운영 인증 수단을 추가하지 않는다.

이번 생성 SQL은 인증 테이블 여섯 개를 만들고 기본 접근 권한을 차단한다. 런타임 역할 부여, tickets FK 전환, 서비스 접근 정책은 후속 마이그레이션이다. 출처를 알 수 없는 기존 better_auth 스키마는 변경을 거부한다. 관리 대상 스키마에는 반복 적용할 수 있으나, 이미 수정된 스키마를 자동 수리하는 기능은 아니므로 확인 SQL과 호환성 검사를 함께 실행한다.

복원은 신규 인증 데이터가 없는 전환 전 단계에만 허용하며, 데이터가 있거나 외부 의존성이 있으면 실패한다. CASCADE로 데이터·의존성을 지우지 않는다. 운영 DB에는 아직 실행하지 않았다.

### 현재 실행 계획 — 새 카카오 사용자로 시작

1. 아래 명명 규칙에 따라 비공개 `better_auth` 스키마와 기본 인증·카카오 확인 테이블을 생성한다. 신규 users.id는 UUID로 발급한다. 별도 public.users/profiles를 추가하지 않는다.
2. 본인 카카오 계정으로 최초 로그인하여 새 users·accounts·sessions 생성을 확인하고, 재로그인 시 같은 사용자로 연결되는지 검증한다. 이전 Google 사용자 UUID와 동일할 필요는 없다.
3. 본인의 기존 테스트 이용권을 새 UUID로 재연결하거나 새 이용권을 발급한다. 기존 tickets 행을 조사하여 이전 UUID 참조를 처리한 뒤 FK를 `better_auth.users.id`로 전환한다. 기존 FK가 실제로 없다면 새 참조를 추가한다. 새 FK 검증을 통과하지 못하는 행을 방치하지 않는다. 기존 행의 일괄 삭제는 이 명세 변경으로 실행하지 않는다.
4. 서비스의 로그인·로그아웃·사용자 조회·보호 페이지를 Better Auth로 연결하고, Supabase Data API/RLS가 새 사용자와 실제 세션을 기준으로 기존 이용권 유효기간을 검사하도록 전환한다.
5. 휴대폰에서 접근 가능한 HTTPS 검증 주소와 해당 앱의 Redirect URI를 준비한다. iOS·Android의 실제 카카오톡에서 공유 링크 → 카카오 로그인/동의 → 서비스 복귀 → 전화번호 확인 → 이용권 접근을 검증한다. 각 환경의 확인 여부를 따로 기록한다. 기존 데스크톱 실연동을 모바일 확인 완료로 간주하지 않는다.
6. 현재 로그인 진입은 Better Auth의 REST OAuth 흐름이다. 카카오톡 앱을 이용한 간편 로그인 전환이 필요한 경우 JavaScript SDK 흐름과 Better Auth callback의 state·세션 검증을 함께 설계하고 검증한다. 같은 계정 하나로 첫 가입·재로그인·로그아웃·이용권 만료를 검증하고, 미동의·응답 장애 등은 자동 검사로 보완한다.
7. 검증 완료 후 실제 서비스 앱의 도메인·callback·전화번호 동의 권한으로 확인한다. 개발 앱과 운영 앱의 사용자 subject는 동일하다고 가정하지 않는다. 전환 이후 사용하지 않는 Supabase Auth 코드와 이관 전용 도구를 정리한다.

현재 원본 전체 복사용 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL` 설정은 선행 조건이 아니다. 운영 스키마·권한·FK를 적용할 SQL 실행 경로는 필요하며, 저장소 절차에 따라 검증된 SQL을 대시보드 SQL Editor에서 적용할 수도 있다. Better Auth 서버용 SQL 접속 자격은 별도로 설정해야 한다.

## 운영 스키마와 테이블 설계

이 절은 운영 전환의 설계 명세다. 신규 인증 생성 DDL은 작성했고 운영 적용은 아직 하지 않았다. `kakao_test_auth`는 개발 앱 실연동 검증용이며, `auth_source`는 로컬 원본 보관용이다.

### 명명 및 책임

기존 `public.books`, `public.chapters`, `public.questions`, `public.tickets`의 복수형 테이블명과 snake_case 열 이름을 따른다. 운영 인증 테이블은 같은 Supabase PostgreSQL 안의 별도 비공개 스키마 `better_auth`에 둔다. Better Auth 서버는 전용 SQL 접속으로 이 스키마에 접근한다. 별도 서비스 프로필을 수집하지 않는 현재 요구사항에서는 `public.users` 또는 `public.profiles`를 추가하지 않는다.

| 정규화된 이름 | 책임 및 핵심 열 |
| --- | --- |
| `better_auth.users` | 서비스 사용자의 인증 기준. `id uuid`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at` |
| `better_auth.accounts` | 제공자 계정과 사용자 연결. `id uuid`, `user_id uuid`, `provider_id`, `account_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at` |
| `better_auth.sessions` | Better Auth 세션. `id uuid`, `user_id uuid`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at` |
| `better_auth.verifications` | Better Auth의 일회성 검증 데이터. `id uuid`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`. 카카오 전화번호 확인 상태와 구분한다 |
| `better_auth.kakao_identities` | 카카오 API로 확인한 신뢰 데이터. `user_id uuid`, `account_id uuid`, `app_id text`, `subject text`, `phone_e164 text`, `status`, `version`, `checked_at` |
| `better_auth.kakao_session_checks` | 현재 로그인 세션이 확인한 카카오 정보 버전. `session_id uuid`, `user_id uuid`, `identity_version`, `checked_at` |
| `public.tickets` | 기존 서비스 이용권. `user_id`, `is_active`, `started_at`, `expires_at`를 유지한다 |

`accounts.account_id`는 Better Auth의 제공자 subject를 저장하는 text 열이고, `kakao_identities.account_id`는 로컬 `accounts.id`를 참조하는 uuid 열이다. DDL 및 애플리케이션 타입에서 이 구분을 명시한다. 카카오 subject는 앱 ID와 함께 식별한다. 개발 앱과 운영 앱은 인증 DB 및 설정을 분리한다.

### 핵심 제약

아래 1번의 기존 UUID 보존은 기존 사용자 이관을 선택할 때의 규칙이다. 현재 신규 시작 계획에서는 새 UUID를 사용하고 위 실행 계획대로 본인 이용권을 연결한다. 7번의 이용권 행 보존 역시 현재 계획의 재연결 또는 재발급 절차를 따른다. 나머지 인증 무결성 제약은 계속 적용한다.

1. `users.id`는 기존 `auth.users.id`를 그대로 사용한다. 기존 사용자에게 새 UUID를 생성하지 않는다. 신규 사용자만 UUID를 생성한다.
2. `accounts.user_id`와 `sessions.user_id`는 `users.id`를 참조하고 인덱스를 둔다. 한 사용자에게 Google·Kakao 등 여러 account를 연결할 수 있다. 동일 제공자 subject가 여러 사용자에게 연결되지 않도록 `accounts(provider_id, account_id)`에 유일성을 둔다.
3. `sessions.token`은 유일해야 하며, 만료 시각으로 유효성을 판정한다. 시간 열은 저장소 규칙에 따라 `timestamptz`를 사용한다. 필수 여부와 기본값은 설치된 Better Auth 버전의 생성 DDL 및 실제 원본의 null 값을 대조하여 확정한다.
4. `kakao_identities.user_id`는 사용자당 한 행인 기본 키다. `UNIQUE(app_id, subject)`와 `UNIQUE(account_id)`를 두며 `(account_id, user_id, provider_id, subject)`를 `accounts(id, user_id, provider_id, account_id)`에 복합 외래 키로 연결한다. provider_id는 kakao로 제한한다. 앱 ID는 형식만 DB에서 검사하며, 실제 응답과 설정 앱의 일치는 서버가 검증한다. 번호·연결·상태 변경 시 버전 증가와 버전 감소 금지는 DB 트리거로 강제한다.
5. `kakao_session_checks.session_id`는 기본 키다. `(session_id, user_id)`를 `sessions(id, user_id)`에 복합 외래 키로 연결하고, `user_id`를 `kakao_identities.user_id`에 연결한다. 이를 위해 sessions에 대응하는 복합 UNIQUE를 둔다. 세션 삭제 시 해당 확인 행은 함께 삭제한다. `identity_version`은 요청 시 현재 버전과 일치해야 하며, 변경 시 과거 세션의 확인 결과가 다시 유효해지지 않도록 버전을 단조 증가시킨다.
6. `phone_e164`는 confirmed일 때만 존재하도록 CHECK 제약을 둔다. 전화번호 자체에는 사용자 고유 키 역할을 부여하지 않는다. 조회 경합은 사용자별 직렬화 또는 요청 세대 번호로 제어하고, 재조회 실패·철회·변경 시 기존 확인을 무효화한다. 일반 사용자 수정 API에는 이 테이블의 쓰기 경로를 제공하지 않는다.
7. `public.tickets.user_id`는 이관 후 `better_auth.users.id`를 참조한다. 사용자 UUID와 이용권 행 값은 유지한다. 기존 외래 키 이름·삭제 정책은 원본 카탈로그에서 확인하며, 티켓 보존을 위한 새 참조는 `ON DELETE RESTRICT`를 기본 설계로 한다. 계정 삭제 정책과 다른 경우 적용 전에 명시적으로 조정한다.

### 이전 설계 참고 — Supabase 원본 매핑

| 원본 | 목적지 또는 처리 |
| --- | --- |
| `auth.users.id` | `better_auth.users.id`에 동일 UUID |
| `auth.users.email`, `email_confirmed_at` | `users.email`, `users.email_verified`. null·중복·확인 상태 충돌은 조사 결과로 해소하고 임의 이메일이나 확인 상태를 만들지 않는다 |
| `auth.users.created_at`, `updated_at` | `users.created_at`, `updated_at`. 원본의 정밀도와 null 허용 여부를 검증한다 |
| `auth.users.raw_user_meta_data` | 원본 전체 보존. 실제 존재하는 이름·이미지 필드만 명시적 규칙으로 `users.name`, `users.image`에 매핑한다 |
| `auth.identities.user_id` | `accounts.user_id`에 동일 UUID |
| `auth.identities.provider`와 제공자 식별자 | `accounts.provider_id`, `accounts.account_id`. identity 행의 자체 id와 제공자 subject를 구분한다. 실제 열 및 identity_data 구조를 대조한다 |
| `auth.identities.id` | UUID 호환 여부를 확인해 account 기본 키로 보존하거나, 별도 매핑으로 원본 identity와 연결한다. 사용자 UUID 보존과 별개다 |
| 기존 암호 해시 | 비밀번호 계정이 실제 존재하면 `accounts.password`로 변환하기 전에 검증기 호환성을 시험한다 |
| 차단·삭제·제한 상태 | 원본에 보존하고 운영 로그인/세션 검사에도 반영한다. 실제 상태 조사 후 Better Auth 플러그인 또는 전용 상태 필드로 매핑하며, 미반영 사용자를 활성 상태로 이관하지 않는다 |
| 기타 원본 열·JSON·확인 시각 | `auth_source` 스냅샷에 출처와 함께 보존한다. 인증 동작에 영향을 주는 열은 별도 매핑 없이는 완료 처리하지 않는다 |
| 기존 Supabase 세션 | 새 Better Auth 세션으로 재로그인한다 |
| 기존 메타데이터 전화번호 | 원본 값으로 보관하며, 새 카카오 API 검증 전에는 confirmed로 취급하지 않는다 |

이관 삽입 순서는 users → accounts → 제약 및 참조 검증이다. 세션은 사용자 재로그인 때 생성한다. 이용권의 기존 FK를 유지한 채 새 FK를 추가·검증한 다음 전환 시 기존 FK를 제거하는 절차를 준비한다. 실제 운영 테이블·제약 조사 전에는 FK 삭제 SQL을 추정하여 작성하지 않는다.

### Better Auth 설정과 스키마 접근

Better Auth 논리 모델 `user`, `account`, `session`, `verification`은 각각 `modelName`으로 복수형 테이블에 매핑하고, `fields`로 `userId → user_id`, `emailVerified → email_verified`, `createdAt → created_at` 등 전체 camelCase 필드를 매핑한다. 애플리케이션이 사용하는 Better Auth API 필드 이름은 그대로 유지한다. [공식 모델·열 매핑 문서](https://better-auth.com/docs/concepts/database)를 기준으로 한다.

SQL 파일에는 `better_auth.users`처럼 항상 스키마를 명시한다. 현재 pg Pool 어댑터를 유지할 경우 테이블 modelName에는 `users` 등을 넣고 전용 접속의 search_path를 `better_auth,pg_catalog`로 고정한다. `public`은 포함하지 않는다. 스키마 소유·DDL 권한은 마이그레이션 역할에 두고 일반 실행 역할에는 CREATE를 주지 않는다. 연결 방식에서 startup options가 지원되는지 검증하고, 지원되지 않으면 전용 DB 역할 설정으로 동일 경로를 보장한다.

`better_auth`는 Supabase Data API 노출 스키마에 추가하지 않는다. `PUBLIC`, `anon`, `authenticated`에 스키마/테이블 직접 접근 권한을 주지 않는다. 인증 런타임과 데이터 조회 역할을 분리하고, 전화번호 검증 데이터 쓰기는 검증 서버 경로와 전용 권한으로 제한한다. 일반 계정 정보 수정이 카카오 신뢰 데이터를 바꿀 수 없어야 한다.

UUID와 FK를 유지하는 작업에 더해 기존 `auth.uid()` 기반 RLS에 Better Auth 세션을 연결하는 작업이 필요하다. 기존 이용권 유효기간 조건을 유지하면서 내부 토큰·실제 세션·카카오 확인 상태를 대조하는 접근 경로를 별도로 검증한다. 스키마 생성과 행 이관만으로 로그인 전환 완료를 선언하지 않는다.

운영 DDL은 `supabase/migrations/<timestamp>_<name>.sql`, 복원 SQL은 같은 timestamp의 `supabase/rollback/`, 검증 SQL은 `supabase/verification/`에 둔다. 기존 `auth` 스키마는 Supabase 관리 영역으로 유지하고 Better Auth 테이블 생성 대상으로 사용하지 않는다.

## 이전 설계 참고 — 원본 스냅샷 실행 준비

```sh
pnpm auth-migration:setup
pnpm auth-migration:db
```

setup은 기존 `.env.local`을 보존하면서 로컬 DB 비밀번호와 연결 URL을 추가한다. 파일 권한은 0600이다. 사용자는 `.env.local`의 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`에 원본 SQL 연결 문자열을 입력한다. 공개 API 키로는 인증 원본 테이블을 복사할 수 없다. 원본에는 대상 세 테이블의 전체 행을 SELECT할 권한이 필요하다. 복사기는 READ ONLY 트랜잭션을 사용하고, RLS로 일부 행만 보이는 접속은 실패시킨다. 원본 테이블에 쓰는 명령은 없다.

연결 문자열 형식은 `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`다. 비밀번호의 URL 특수 문자는 percent encoding한다. 쿼리 파라미터는 받지 않으며 원격 TLS 인증서 검증은 코드에서 활성화한다. 인증서 문제를 검증 비활성화로 우회하지 않는다. 키나 사용자 데이터를 채팅·Git·공개 이슈에 붙여 넣지 않는다.

```sh
pnpm auth-migration:snapshot
```

출력은 실행 UUID, 테이블별 행 수, 저장 검증 성공 여부뿐이다. 상세 원본은 로컬 PostgreSQL 볼륨에만 보관한다. 이 볼륨은 자동 암호화 아카이브가 아니며 비밀번호 해시 등 원본의 민감 필드도 포함한다. 완료 후 보존 기간과 삭제 시점을 결정하고 수동으로 정리한다. 기본 명령은 볼륨을 삭제하지 않는다.

## 원본 보존 방식

세 테이블을 하나의 REPEATABLE READ READ ONLY 트랜잭션에서 읽는다. 열 목록·형식과 테이블 제약 정의를 함께 보관한다. 원본의 모든 열을 `row_to_json(... )::text`로 직렬화하여 자바스크립트 숫자·날짜 변환을 거치지 않고 저장한다. 이는 행 값의 논리적 스냅샷이며 인덱스·함수·권한·전체 DB를 복원하는 pg_dump 백업을 대체하지 않는다.

250행씩 읽어 저장하고 저장된 문자열을 다시 읽어 행 수와 SHA-256을 대조한다. 한 테이블이라도 실패하면 해당 실행 전체를 롤백한다. 재실행은 새로운 실행 UUID로 새 스냅샷을 만들며 기존 원본을 덮어쓰지 않는다. 부분 복사를 이어 붙이지 않고 새 시점에서 다시 복사한다. 복사 완료 후 발생한 운영 변경은 별도 최종 스냅샷과 차이 대조가 필요하다.

## 이전 설계 참고 — 원본 보존 이관을 선택할 경우의 변환 기준

1. 실제 열·계정 유형·제공자·차단 및 삭제 상태·이용권 참조를 조사하여 전체 필드 매핑을 확정한다. 충돌은 보고하고 자동 병합하거나 누락하지 않는다.
2. `auth_source`를 보존한 채 별도 Better Auth 스키마로 변환한다. user UUID와 모든 provider subject 연결을 유지하고, 원본 필드 중 직접 대응하지 않는 값은 출처와 함께 보존한다. 로그인 제한과 이메일 확인 상태도 별도로 반영한다.
3. 변환 전후 전체 필드, 계정 연결 및 이용권 참조를 대조한다. 비밀번호 계정이 실제로 있으면 해시 호환성을 검증한다. 세션은 재로그인으로 발급하고 제공자 토큰이 없는 경우 재인증한다.
4. 기존 사용자로 로그인한 상태에서 명시적으로 카카오 계정을 연결한다. 원본 메타데이터의 전화번호를 카카오 확인 완료 값으로 승격하지 않는다. 실제 카카오 API 검증으로만 신뢰 값을 생성한다.
5. 서비스 로그인과 Supabase Data API/RLS를 Better Auth 사용자·세션에 연결하고 기존 사용자 접근 및 새 사용자 접근을 검증한다.
6. 최종 백업·쓰기 중단 또는 변경분 확보·최종 대조·전환 및 복구 절차를 준비한 뒤 운영 전환한다. 임시 스냅샷 성공을 운영 이관 완료로 기록하지 않는다.

트랜잭션 기준은 [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html)과 [트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html)를 따른다.
