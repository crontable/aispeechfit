# 카카오 서비스 로그인과 데이터 연결

## 구현 상태

로그인 화면의 Google 버튼·인앱 브라우저 경고를 제거하고 Better Auth 카카오 로그인을 연결했다. `/auth/complete`에서 현재 세션의 전화번호를 자동 확인하고 `/study`로 이동한다. `/study` 레이아웃과 챕터 페이지는 각각 서버에서 세션·전화번호 확인·이용권을 검사한다. `/unauthorized`도 서버가 이용권을 조회하며 조회 실패와 이용권 부재를 구분한다. 로그아웃은 Better Auth 세션을 종료한다. 구 `/auth/callback`은 Supabase 세션 교환 없이 로그인 화면으로 돌려보낸다.

현재 로컬은 기존 개발 앱과 `better_auth` 테이블을 사용한다. 서비스 화면에서 실제 카카오 로그인 → 전화번호 자동 확인 → 이용권 조회 불가 안내까지 확인했다. 실제 Supabase Data API 연결 설정과 본인 이용권 연결은 아직 완료하지 않았다. 이 상태에서 조회 불가 안내를 이용권이 없다는 증거로 사용하지 않는다.

## 데이터 연결 구성

`lib/data/token.ts`는 검증된 세션의 사용자 UUID와 session ID를 담은 ES256 토큰을 만든다. 수명은 최대 60초이며 세션 만료를 넘기지 않는다. `lib/data/client.ts`는 서버에서만 토큰을 전달한다. 세션과 사용자가 다르거나 만료되면 토큰을 만들지 않는다. 비밀키·토큰·전화번호 원문은 브라우저로 전달하지 않는다.

`supabase/migrations/20260913010000_connect_better_auth_access.sql`은 기존 #26 정책에 새 세션 조건을 AND로 추가하는 restrictive 정책을 적용한다. 이용권은 유효한 새 세션의 본인 행만 보이고, 학습 자료는 현재 전화번호 확인 버전과 이용권 조건까지 만족해야 한다. 보조 함수는 현재 요청에 대한 boolean만 반환하며 고정 search_path로 인증 테이블을 읽는다. 기존 공개 정책을 무조건 삭제하지 않는다.

이 SQL은 기존 tickets 행이나 FK를 변경하지 않는다. 실제 FK·이용권을 조회한 뒤 별도 데이터 연결 SQL을 작성해야 한다. 함께 둔 복원 SQL은 기존 #26 정의로 돌아가는 전환 전 복구용이며, 운영에 적용하기 전 실제 정의를 기록하고 비교해야 한다.

## 운영 연결 전 준비

1. 원본 SQL 접속으로 실제 테이블·FK·정책·역할을 읽기 전용으로 확인한다. 전체 사용자 이관은 수행하지 않는다. `.env.local`의 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`은 이 조사에 사용할 수 있다.
2. 같은 검증용 Supabase 프로젝트 안에 인증 스키마와 서비스 테이블을 준비한다. 현재 로컬 인증 DB와 원격 서비스 DB를 조합한 상태에서는 원격 정책이 로컬 세션을 읽을 수 없으므로 접근 완료로 간주하지 않는다.
3. 인증 실행 역할과 전화번호 쓰기 권한을 구성하고 `AUTH_DATABASE_URL`을 설정한다. 현재 로컬의 DB 소유자 접속을 운영 자격으로 사용하지 않는다. 이번 단계에서는 운영 역할·별도 쓰기 자격을 아직 구성하지 않았다.
4. Supabase에 가져온 ES256 서명 키의 개인 JWK와 kid를 서버의 `SUPABASE_DATA_SIGNING_JWK`에 설정한다. 원격 Data API가 실제 서명을 수용하는지 검증한다. 일반 조회에 service_role 키를 사용하지 않는다.
5. 기존 정책 기록과 복구 준비 후 새 정책을 적용하고 직접 Data API 테스트를 수행한다. 본인 이용권 참조를 새 사용자로 연결한다. 로컬 정책 검사 통과를 원격 Data API 검증으로 대체하지 않는다.
6. 위 조건이 맞는 배포 환경에서만 `BETTER_AUTH_DATA_API_READY=true`로 설정한다. 값이 없거나 false면 앱은 데이터 조회를 시도하지 않고 조회 불가 상태를 표시한다.
7. `BETTER_AUTH_URL`의 HTTPS 주소와 카카오 callback `/api/auth/callback/kakao`를 맞춘다. 실제 서비스 설정을 시험할 때 로컬 검증 우선 설정인 `KAKAO_AUTH_TEST_ENABLED`를 해제한다. 운영에서는 이 개발 플래그가 무시된다.
8. 실제 모바일 카카오톡에서 로그인·복귀·학습 접근을 확인한 뒤 배포한다.

## 검증 범위

### 원본 연결 점검

`pnpm auth-migration:inspect`는 TLS 인증서 검증을 사용하고, `REPEATABLE READ READ ONLY` 트랜잭션에서 이용권 열·외래 키·정책·권한과 집계 건수만 조회한다. 사용자 행, 인증 토큰, 전화번호, 접속 문자열을 출력하거나 복제하지 않는다. RLS로 일부 행만 보이는 집계를 전체 건수로 오인하지 않도록 `row_security = off`를 설정하고 권한이 부족하면 실패한다.

2026-09-13 원본 접속 설정이 입력된 뒤, Direct connection 호스트가 현재 서비스 프로젝트와 일치함을 확인했다. DNS에는 IPv6 주소만 있었고 현재 실행 환경의 연결은 `ENOTFOUND`로 실패했다. DB 조회는 수행되지 않았다. Connect → Method → Session pooler에서 제공되는 호스트(`…pooler.supabase.com`)와 포트 `5432`를 사용하는 연결 문자열로 교체해야 한다. 사용자 이름도 제공된 문자열을 그대로 사용하고 DB 비밀번호를 채운다. 원본 조사 전까지 실제 이용권 건수·FK·정책은 미확인 상태다.

`pnpm test:service-auth`는 ES256 서명·만료·사용자 결합, Google 요청/외부 Origin/보호 필드 차단, 실제 PostgreSQL에서 새 UUID·타인 이용권·구 발급자·전화번호 버전·이용권 만료/비활성·삭제 세션을 검사한다. 임시 DB에 실제 #26 정책과 새 SQL을 적용하고 합성 자료를 조회한다. 부모 검사 포함 8개이며 HTTP Data API 자체의 서명 검증은 후속이다.

공식 근거는 [Supabase 외부 JWT](https://supabase.com/docs/guides/auth/jwts), [서명 키 가져오기](https://supabase.com/docs/guides/auth/signing-keys)다.
