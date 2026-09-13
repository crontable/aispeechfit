# Better Auth 인증 스키마와 보존 명세

현재 이슈 #32는 이미 생성된 Better Auth 사용자·계정·이용권을 유지하며 전화번호 수집과 접근 조건을 제거한다. 기존 Supabase Auth 전체 이관·신규 인증 스키마 초기화·이용권 재할당을 실행하지 않는다. 앞선 이슈 #20에서 신규 카카오 사용자로 전환했던 계획과 실제 적용 기록은 Git 이력 및 해당 이슈에 남긴다.

## 현재 스키마

| 테이블 | 책임과 참조 |
| --- | --- |
| `better_auth.users` | 사용자 UUID와 이름·이메일·이미지를 저장한다. |
| `better_auth.accounts` | `user_id`가 users를 참조한다. `provider_id`와 외부 식별자 `provider_account_id(text)`가 제공자 계정을 구별하고 OAuth 토큰은 암호화한다. 내부 기본 키 `id`는 UUID다. |
| `better_auth.sessions` | `user_id`가 users를 참조한다. 토큰·만료 시각과 실제 세션 행으로 인증한다. |
| `better_auth.verifications` | OAuth 등 일회성 검증 자료를 저장한다. 전화번호 확인 테이블과 별개다. |
| `better_auth.kakao_identities` | 과거 전화번호 확인 자료와 카카오 앱·계정 식별 관계가 함께 있다. 새로운 로그인과 자료 접근에서 읽거나 쓰지 않는다. |
| `better_auth.kakao_session_checks` | 과거 세션의 전화번호 확인 관계다. 실제 세션 삭제에 따른 기존 FK 동작을 유지한다. |
| `public.tickets` | `user_id`가 Better Auth 사용자 UUID를 참조한다. 소유자·활성 상태·시작·만료 시각을 보존한다. |
| `auth_source.tickets` | 과거 이용권 보관 자료다. 일반 실행 역할에 공개하지 않는다. |

공통 인증 매핑은 `supabase/functions/_shared/auth/schema-options.ts`를 `lib/auth/schema-options.ts`가 다시 내보낸다. 전용 SQL 연결의 search_path는 `better_auth,pg_catalog`로 고정한다. `better_auth`를 Data API 노출 스키마에 추가하지 않으며 일반 사용자 역할에는 직접 접근을 허용하지 않는다.

계정 열 이름은 `20260913050000_rename_provider_account_id.sql`과 새 애플리케이션 매핑으로 함께 바꾼다. 운영 DB 반영은 이슈 10번이다. UUID·식별값·복합 FK와 원본·테스트 앱 관계의 보존 기준은 [계정 보존 명세](./PHONE-REMOVAL-OPERATIONS.md), SQL 적용·복원은 [4번 구현 명세](./PHONE-REMOVAL-S3.md)를 따른다.

## 로컬 검사

`pnpm auth-migration:setup`과 `pnpm auth-migration:db`로 55433의 별도 PostgreSQL을 준비한다. `pnpm test:auth-schema`는 새 임시 DB에서 스키마 생성·반복 적용·열 정정·Better Auth 호환성·OAuth·UUID·제약·일반 역할 접근·복원 조건을 검증한다. 과거 번호 상태와 버전 제약 검사도 기존 식별 자료 보존을 위해 남긴다. 정확한 검사 수는 각 실행 결과로 기록한다.

`auth-schema:apply`는 로컬 기본 DB에 초기 인증 스키마와 계정 열 정정을 적용한다. 운영 전환 또는 public 접근 정책 전체 적용 명령이 아니다. 기본 스키마 rollback은 데이터나 외부 의존성이 있으면 중단한다. `CASCADE`로 강제 삭제하지 않는다.

## 종료한 전환 도구와 과거 스냅샷

이전 `auth-schema:runtime`, `auth-schema:preflight`, `auth-schema:cutover`, `auth-migration:prepare-ticket`는 전화번호 권한·확인 상태·선택 이용권 이전에 의존하여 사용을 종료했다. 실행하면 설정과 DB를 읽기 전에 오류로 끝난다. 필요한 운영 권한 변경은 9번에서 검토한 개별 SQL을 10번에 실행한다.

`auth-migration:inspect`는 이전 Supabase Auth 관계를 기준으로 메타데이터와 집계를 읽는다. 현재 Better Auth 사용자에게 연결된 이용권을 이전 `auth.users`에서 찾지 못하는 결과를 현행 FK 고아 행으로 해석하지 않는다. `auth-migration:snapshot`은 과거 원본 보관 도구로 유지하며 이슈 #32의 선행 단계가 아니다.

스냅샷 원본은 `auth.users`, `auth.identities`, `public.tickets`다. 하나의 REPEATABLE READ READ ONLY 트랜잭션에서 모든 열을 JSON 문자열로 읽고 로컬 `auth_source`에 저장한다. 열·제약 정의와 행 수·SHA-256을 대조하며 부분 실패는 롤백한다. 재실행은 새 실행 UUID를 만들고 기존 사본을 덮어쓰지 않는다. 비밀번호 해시 등 민감 필드가 포함될 수 있으며 논리적 행 스냅샷은 전체 DB 백업을 대체하지 않는다. `pnpm test:auth-migration`은 합성 원본으로 이 동작을 검사한다. 실제 스냅샷 실행과 보관·폐기는 범위를 확인한 별도 작업이다.
