# 전화번호 없는 카카오 개발 검사

이슈 #32의 개발 도구 명세다. 기본 OAuth는 이메일과 닉네임 범위를 요청하며, 제공자 응답에서 필요한 프로필 값만 저장한다. 전화번호 요청·정규화·저장·재확인 버튼과 API는 제거했다.

## 1. 브라우저와 로컬 DB의 연결을 구분한다

브라우저의 `/sign-in` → `/api/auth`는 Next.js 프록시를 거쳐 `AUTH_FUNCTION_URL`의 Supabase Edge Function으로 전달된다. `KAKAO_AUTH_TEST_ENABLED=true`는 이 프록시를 로컬 DB로 전환하지 않는다. `/dev/kakao`는 개발 모드의 `localhost:3000`에서만 공통 로그인 화면으로 이동하며 나머지는 404다.

`BETTER_AUTH_URL`의 Origin, `AUTH_FUNCTION_URL`의 프로젝트·함수 경로, 그 함수의 DB 역할과 대상, 카카오의 `<Origin>/api/auth/callback/kakao`를 함께 확인한다. 원격 함수의 고정 Origin과 다르면 로컬 브라우저 로그인을 허용하지 않는다. 원본 앱 실제 로그인과 모바일 카카오톡 검사는 이슈 10번의 검증 환경에서 한다. 로컬 DB 명령을 실행한 사실만으로 브라우저 로그인도 그 DB를 사용한다고 기록하지 않는다.

## 2. 자동 OAuth 검사 준비

Node.js 24, pnpm과 Docker를 준비하고 저장소에서 다음을 실행한다. setup은 기존 환경 값을 유지하고 없는 키만 알파벳순으로 추가한다. `.env.local` 권한은 0600이다. `KAKAO_APP_ID`와 전화번호 DB URL은 필요하지 않다.

```sh
pnpm install --frozen-lockfile
pnpm kakao:setup
pnpm kakao:db
pnpm kakao:migrate
pnpm test:kakao
```

이 명령은 `127.0.0.1:55432/kakao_test`의 별도 DB를 사용한다. migrate는 Better Auth 기본 스키마를 먼저 생성하고 인증 인스턴스를 초기화한다. 신규 초기화에 전화번호 테이블을 만들지 않으며, 이미 있는 과거 테이블과 자료는 유지한다. 검사는 가상 카카오 응답과 실제 Better Auth·임시 PostgreSQL DB를 사용한다. 제공자 키는 합성 값으로 주입하므로 자동 검사를 위해 실제 카카오 동의를 받을 필요가 없다.

현재 서비스용 인증 스키마를 검사하려면 별도로 다음을 실행한다.

```sh
pnpm auth-migration:setup
pnpm auth-migration:db
pnpm test:auth-schema
pnpm test:service-auth
pnpm test:edge-auth
pnpm test:auth-tools
```

대상은 `127.0.0.1:55433/auth_migration`이다. 각 DB 검사는 새 임시 DB를 만들고 자신이 만든 자원만 정리한다. 기본 DB·볼륨을 초기화하지 않는다. `auth-schema:apply`는 이 기본 DB에 초기 스키마·계정 열 정정을 적용하는 준비 명령이며 자동 검사는 자체 임시 DB를 사용하므로 선행 실행이 필요하지 않다.

## 3. 증거 수집과 보존

`pnpm kakao:evidence`와 `pnpm auth-schema:evidence`는 각각 위 DB의 사용자 수·카카오 계정 수·활성 세션 수와 저장된 토큰의 암호화 여부만 출력한다. 전화번호와 확인 테이블을 조회하지 않는다. 토큰이 없으면 암호화 여부는 `null`, 복호화 실패나 평문이면 `false`다. 사용자 식별값·이메일·토큰 원문을 출력하지 않는다. 암호화 확인에는 저장 당시의 Better Auth secret이 필요하다.

기본 OAuth의 scope·callback·state, 전화번호 없는 가입·재로그인, 토큰 암호화, 로그아웃·만료, 일반 수정 API 보호, 기존 식별자 보존을 자동 검사한다. 과거 전화번호 fixture는 새 OAuth가 해당 행을 생성하거나 수정하지 않는지 검증하기 위해 테스트 디렉터리에만 둔다.

## 4. 과거 실연동 기록의 범위

이슈 #20의 2026-09-13 11:05~11:06 KST 검증에서는 개발 앱 실제 로그인·전화번호 수신·저장·로그아웃·재로그인·새 세션 확인을 완료했다. 이는 전화번호가 필수였던 당시 요구사항의 기록이다. 이슈 #32의 전화번호 제거 후 실연동 완료 근거로 사용하지 않는다. 상세 당시 구현·검증 기록은 Git 이력의 이 문서와 이슈 #20에 남아 있다.

계정 식별 관계·과거 자료 보존·권한과 Secret 정리 시점은 [운영 정리 명세](./PHONE-REMOVAL-OPERATIONS.md)를 따른다. 기존 `.env*`, 로컬 볼륨, 운영 개인정보는 이번 도구 변경으로 삭제되지 않는다.
