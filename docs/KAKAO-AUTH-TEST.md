# 카카오 개발 앱으로 Better Auth 연동 검증

이 문서는 [이슈 #20](https://github.com/crontable/aispeechfit/issues/20)의 첫 단계인 개발 앱 실연동 검증 명세와 실행 절차다. Better Auth 1.7.4가 카카오 로그인을 처리하고, Next.js 서버가 카카오 전화번호를 받아 출처를 검증한 뒤 저장한다.

## 1. 실행 범위

2026-09-13 후속 단계부터 현재 `/dev/kakao`와 `/api/auth`는 `lib/auth/`의 새 인증 코드와 `127.0.0.1:55433/auth_migration`의 `better_auth` 스키마를 사용한다. 아래 기존 `kakao_test_auth` 설명과 검사 21개는 첫 실연동 기록이다. 기존 DB는 변경하지 않았으며 신규 실행은 다음 명령을 따른다.

```sh
pnpm kakao:setup
pnpm auth-migration:setup
pnpm auth-migration:db
pnpm auth-schema:apply
pnpm kakao:dev
```

기존 카카오 키·앱 ID·callback을 그대로 사용한다. 새 스키마용 쿠키 접두사를 사용하므로 이전 검증 세션과 분리된다. `pnpm auth-schema:evidence`로 새 스키마 결과를, `pnpm test:auth-schema`로 새 콜백·스키마 검사 22개를 확인한다. `pnpm kakao:evidence`는 이전 DB 결과만 조회한다.

새 코드 실연동에서 실제 카카오 최초 로그인·전화번호 저장·로그아웃·재로그인을 확인했다. 로그아웃 시 활성 세션 0개, 재로그인 시 사용자 1개·카카오 계정 1개·활성 세션 1개·확인된 활성 세션 0개로 중복 없는 가입과 새 세션 재확인을 확인했다. 제공자 토큰 암호화 확인도 통과했다. 서비스의 기존 Google 로그인, 이용권 조회, RLS는 아직 전환하지 않았다.

## 1-1. 첫 개발 검증 기록

`/dev/kakao`에서 로그인과 전화번호 확인을 실행한다. 인증 테이블은 Docker Compose가 별도로 만든 `127.0.0.1:55432/kakao_test`의 `kakao_test_auth` 스키마를 사용한다. 현재 Supabase의 사용자·이용권·RLS와 독립된 개발 검증 환경이다. 실제 사용자 데이터 이관과 서비스 로그인 전환은 이슈 #20의 후속 단계다.

검증 경로는 `KAKAO_AUTH_TEST_ENABLED=true`이고 `NODE_ENV`가 production이 아닐 때만 열린다. Next.js 개발 서버는 localhost에 바인딩한다. 원격 DB 연결과 다른 DB 이름·포트는 설정 검사에서 거부한다. 개발 앱의 계정 ID는 운영 앱의 계정 ID로 이관하지 않는다.

## 2. 개발자센터 설정

기존에 생성한 개발 전용 테스트 앱을 선택한다. 테스트할 카카오 계정은 해당 앱의 멤버여야 한다.

1. **앱 → 플랫폼 키 → 사용할 REST API 키**를 연다. 키 값을 `.env.local`의 `KAKAO_CLIENT_ID`에 입력한다.
2. 같은 REST API 키의 클라이언트 시크릿을 `KAKAO_CLIENT_SECRET`에 입력한다.
3. 같은 키의 **카카오 로그인 리다이렉트 URI**에 `http://localhost:3000/api/auth/callback/kakao`를 추가하고 저장한다.
4. 앱 정보 상단의 숫자 앱 ID를 `KAKAO_APP_ID`에 입력한다. 이는 토큰을 발급한 앱이 맞는지 서버에서 확인하는 기준이다.
5. **카카오 로그인 → 사용 설정**에서 ON을 확인한다.
6. **카카오 로그인 → 동의항목 → 개인정보**에서 `account_email`, `profile_nickname`, `phone_number`를 설정한다. 검증 코드는 이 세 scope를 요청한다. 전화번호는 기존에 설정한 동의 단계를 유지하여 먼저 실연동한다.

현재 카카오 문서의 Redirect URI와 시크릿 설정 위치는 REST API 키 상세 화면이다. [카카오 앱 설정](https://developers.kakao.com/docs/ko/app-setting/app#redirect-uri), [카카오 로그인 설정](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [테스트 앱](https://developers.kakao.com/docs/ko/app-setting/app#test-app)을 기준으로 한다.

## 3. 로컬 실행

Node.js 24와 Docker가 필요하다. 저장소 루트에서 실행한다.

```sh
pnpm install --frozen-lockfile
pnpm kakao:setup
```

setup은 기존 `.env.local` 값을 보존하고, 없는 개발 설정만 추가한다. 인증 비밀값과 DB 비밀번호는 난수로 생성하고 파일 권한을 0600으로 설정한다. 카카오 키 두 개와 앱 ID를 채운다. 기존 파일에 `KAKAO_AUTH_TEST_ENABLED=false`를 설정했다면 직접 true로 바꾼다.

```sh
pnpm kakao:db
pnpm kakao:migrate
pnpm kakao:dev
```

`http://localhost:3000/dev/kakao`를 연다. 이 주소는 개발자센터에 등록한 callback과 함께 localhost:3000을 사용해야 한다. 설정을 바꿨다면 개발 서버를 재시작한다.

1. **카카오로 로그인**을 선택한다.
2. 테스트 앱 멤버 계정으로 로그인하고 카카오 동의 화면을 확인한다.
3. 복귀한 검증 화면에서 **카카오 전화번호 확인 및 저장**을 선택한다.
4. 현재 세션의 전화번호 확인이 완료되고, 마스킹된 번호와 서버 확인 시각이 표시되는지 확인한다.
5. 로그아웃 후 다시 로그인한다. 새 세션은 전화번호 확인이 대기로 표시되며, 다시 서버에서 확인해야 한다.

DB 중지는 `docker compose --env-file .env.local -f compose.kakao-test.yml stop`을 사용한다. 검증 데이터를 유지하는 명령이다. 로그인 세션은 한 시간 후 만료된다.

## 4. 전화번호 저장 명세

브라우저는 전화번호·카카오 토큰·사용자 ID를 서버에 제출하지 않는다. 검증 API는 빈 POST 본문만 허용하고 Origin과 Host를 검사한다. 서버는 다음 순서로 처리한다.

1. Better Auth의 DB 세션을 검증한다.
2. 그 사용자에게 연결된 단일 카카오 account를 DB에서 선택한다.
3. 선택한 Better Auth account 레코드 ID로 서버 API의 `getAccessToken`을 호출한다. 필요하면 Better Auth가 토큰을 갱신한다.
4. `/v1/user/access_token_info`의 앱 ID·사용자 ID와 `/v2/user/me`의 사용자 ID를 설정 및 저장된 account subject와 대조한다.
5. `phone_number_needs_agreement=false`, 전화번호 존재, 국제 전화번호 형식을 검사한다. `libphonenumber-js`로 `+82 010-…` 형태도 E.164로 정규화한다.
6. 조회가 끝난 시점에도 세션이 살아 있는지 재검사하고, 트랜잭션 안에서 전화번호와 현재 세션의 확인 상태를 저장한다.

`kakao_identity`는 앱 ID·subject·번호·상태·버전·확인 시각을 보관한다. `kakao_session_check`는 세션 ID와 확인한 번호 버전을 기록한다. 전화번호와 상태가 같으면 버전을 유지하고, 번호 변경이나 동의 미확인·조회 장애가 발생하면 이전 세션의 확인 상태가 유효하지 않게 한다. 조회 실패 시 확인된 번호를 비우고 pending 또는 unavailable로 저장한다. 이 검증 환경은 별도 전화번호 이력을 보관하지 않는다.

같은 사용자의 조회를 PostgreSQL advisory lock으로 직렬화하여 늦게 끝난 이전 응답이 뒤 요청의 값을 덮어쓰지 못하게 한다. 원격 조회 중 로그아웃되었거나 세션이 만료되면 쓰기를 거부한다.

일반 `update-user`에는 name·image만 허용한다. 전화번호·출처·상태 등의 입력은 HTTP 400으로 거부하고, 보호 데이터는 Better Auth user 추가 필드에 넣지 않는다. 제공자 토큰은 암호화하여 DB에 저장한다. 토큰·프로필 조회와 계정 연결 API는 브라우저에 공개하지 않는다. 일반 DB 역할에는 인증 스키마 접근 권한이 없다. UI에는 번호 끝 네 자리만 전달한다. Next.js의 callback 요청 로그에서 인가 코드가 출력되지 않도록 해당 경로의 요청 로깅을 제외한다.

이 구현은 개발 검증용으로 연결·해제 API를 닫아 두었다. 실제 전환에서는 이슈 #20의 명시적 Google·Kakao 계정 연결, 역할 분리, 기존 UUID 유지, 데이터 이관, Supabase Data API의 RLS 연결을 별도로 구현·검증한다.

## 5. 자동 검사와 실연동 증거

```sh
pnpm test:kakao
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

이 작업 환경에서는 Turbopack의 내부 포트 생성이 `Operation not permitted`로 차단되었다. `pnpm exec next build --webpack`으로 프로덕션 빌드·타입 검사·페이지 생성을 완료했고, `kakao:dev`도 webpack으로 실행한다. 기존 기본 build 스크립트는 유지한다.

자동 검사는 같은 로컬 DB 안에 매번 별도 임시 스키마를 만들고 정리한다. 실제 Better Auth 콜백·세션·PostgreSQL을 사용하며, 외부 카카오 응답만 가상 데이터로 대체한다. 가상 응답 검사는 실제 카카오 실연동 성공으로 기록하지 않는다.

검사 범위는 scope와 callback, UUID 생성, 토큰 암호화, 서버 조회·저장, 마스킹, 수정 API 보호, 외부 Origin 차단, 새 세션 재확인, 번호 변경, 동의 철회, 조회 장애, 동시 요청 순서, 일반 DB 역할 차단, 조회 중 로그아웃 및 개발 환경 제한이다.

실연동 결과에는 성공 여부·앱 일치 여부·전화번호 존재 여부·정규화 결과 여부·DB 저장 여부·세션 재확인 결과만 남긴다. 키·시크릿·인가 코드·세션 토큰·원본 전화번호·이메일을 Git이나 이슈에 기록하지 않는다.

`pnpm kakao:evidence`로 원본 정보 없이 DB 검증 결과를 조회한다. `confirmed_phones`와 `checked_active_sessions`가 1 이상이고 `binding_mismatches`가 0인지 확인한다. 로그인만 완료되고 전화번호 조회 버튼을 누르지 않았다면 세션이 있어도 확인된 번호는 0이다.

| 검사 구분 | 현재 상태 |
| --- | --- |
| 로컬 DB 생성 및 인증 스키마 적용 | 완료 |
| 가상 카카오 응답을 통한 자동 회귀 검사 | 21개 통과 |
| 린트·TypeScript·webpack 프로덕션 빌드 | 통과 |
| production에서 개발 경로 차단 | 페이지·인증 API·검증 API 모두 HTTP 404 확인 |
| 개발 앱의 실제 로그인·전화번호 수신 | 완료. 2026-09-13 11:05 KST, 사용자 로그인·동의 후 실제 카카오 API 응답과 DB 저장 확인 |
| 실제 로그아웃·재로그인 | 로그아웃 시 활성 세션 0개. 재로그인 시 활성 세션 1개·확인된 활성 세션 0개 확인 |
| 새 세션에서 전화번호 재확인 | 완료. 2026-09-13 11:06 KST, 재조회 후 확인된 활성 세션 1개 확인 |

최종 `kakao:evidence` 결과는 사용자 1개, 카카오 account 1개, 활성 세션 1개, 확인된 전화번호 1개, 확인된 활성 세션 1개, 앱·계정 연결 불일치 0개다. 저장된 제공자 토큰의 암호화·복호화 가능 여부도 true로 확인했다. 실제 화면에서도 로그인 완료·현재 세션 전화번호 확인 완료·마스킹된 번호·서버 확인 시각을 확인했다. 미동의·미제공·조회 장애·번호 변경·경합 등 부정 경로의 결과는 가상 카카오 응답을 사용한 자동 검사에서 확보했다.

## 6. 후속 전환에서 보존할 조건

개발 앱 실연동 결과를 이슈 #20의 전환 명세에 반영한다. 운영 전환에서는 Supabase `auth.users`·`auth.identities`의 원본 값과 기존 사용자 UUID·이용권 참조를 유지하여 이관하고, 계정 충돌·삭제·차단 상태를 대조한다. 기존 세션은 새 세션으로 재발급하고 카카오 동의를 다시 확인한다. Data API용 내부 JWT와 RLS는 Better Auth의 실제 세션 및 전화번호 확인 상태를 연결해서 검증해야 한다. 이 브랜치의 로컬 결과만으로 운영 마이그레이션이나 RLS 검증 완료를 선언하지 않는다.

구현 기준은 [Better Auth Kakao](https://better-auth.com/docs/authentication/kakao), [PostgreSQL 어댑터](https://better-auth.com/docs/adapters/postgresql), [OAuth 계정 선택과 토큰 조회](https://better-auth.com/docs/concepts/oauth), [Next.js 연동](https://better-auth.com/docs/integrations/next) 및 설치한 1.7.4 소스다.
