# 운영·로컬 환경 설정

| 파일 | 용도 |
| --- | --- |
| `.env` | 운영 서버 설정. 호스팅 환경 변수 가져오기에 이 파일을 사용한다. |
| `.env.local` | 로컬 관리 자격 증명과 개발용 덮어쓰기. 업로드하지 않는다. |
| `.env.example` | 비밀 값 없는 운영 설정 템플릿 |
| `.env.local.example` | 비밀 값 없는 로컬 설정 템플릿 |

두 실제 파일은 Git에서 제외한다. `.env`에는 운영 실행 계정과 인증 설정 11개가 있고, 관리자 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`과 로컬 테스트 DB 비밀번호는 `.env.local`에만 둔다. 운영 파일의 DB 연결 계정은 `better_auth_runtime`, `better_auth_phone_writer`이다.

Next.js 개발 서버는 `.env.local` 값을 `.env`보다 우선한다. Node 관리·검사 명령은 `--env-file=.env --env-file=.env.local` 순서로 두 파일을 읽는다. 로컬에서도 필요한 공통 운영 설정은 `.env`에서 읽으며, 로컬 URL과 테스트 플래그만 `.env.local`에서 덮어쓴다. 별도 환경 파일 생성 명령은 없다.

## 운영 적용

1. Netlify 프로젝트의 **Project configuration → Environment variables → Import from a .env file**에서 `.env`를 가져온다. 다른 호스팅으로 이전할 때도 같은 파일을 해당 호스팅의 환경 변수 가져오기에 사용한다.
2. **Production**에 적용한다. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`는 **Builds와 Functions**에 둔다. 나머지 설정은 **Functions**에만 둔다. 특히 `SUPABASE_DATA_SIGNING_JWK`, DB URL, 인증 시크릿은 빌드에서 사용하지 않는다. 가져오기 후 변수별 범위를 확인한다.
3. 기존 등록 항목에 관리자 연결이나 로컬 테스트 DB 설정이 있다면 제거한다. 파일 가져오기는 불필요한 기존 항목을 자동 삭제하지 않는다.
4. 저장 후 다시 배포하고 첫 화면·카카오 로그인·이용권 조회를 확인한다.

실제 파일을 Git이나 공개 정적 파일로 배포하지 않는다. 운영 도메인이 변경되면 `.env`의 `BETTER_AUTH_URL`과 카카오 개발자센터의 Redirect URI를 함께 수정한다. 현재 Redirect URI는 `https://aispeechfit.crontables.com/api/auth/callback/kakao`이다.

DB 실행 계정 준비·전환 명령은 운영 설정을 `.env`에 저장한다. 관리용 연결 정보는 `.env.local`에서 읽는다. 기존 운영 DB 전환은 완료됐으므로 환경 파일 정리를 위해 DB 전환 명령을 다시 실행하지 않는다.

## 항목별 재검토 결과

| 분류 | 항목 | 보관·범위 |
| --- | --- | --- |
| 공개 설정 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` | `.env`, Builds + Functions |
| 운영 일반 설정 | `BETTER_AUTH_URL`, `BETTER_AUTH_DATA_API_READY`, `KAKAO_APP_ID`, `KAKAO_CLIENT_ID` | `.env`, Functions |
| 운영 비밀 설정 | `AUTH_DATABASE_URL`, `AUTH_PHONE_DATABASE_URL`, `BETTER_AUTH_SECRET`, `KAKAO_CLIENT_SECRET`, `SUPABASE_DATA_SIGNING_JWK` | `.env`, Functions 전용 |
| 로컬 관리 비밀 | `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`, `AUTH_MIGRATION_DATABASE_URL`, `AUTH_MIGRATION_DB_PASSWORD`, `KAKAO_TEST_DATABASE_URL`, `KAKAO_TEST_DB_PASSWORD` | `.env.local` 전용 |
| 개발 덮어쓰기 | `BETTER_AUTH_URL`, `KAKAO_AUTH_TEST_ENABLED`, `KAKAO_REMOTE_AUTH_TEST_ENABLED` | `.env.local` 전용 |

운영 비밀 설정 다섯 개는 서비스 인증과 데이터 요청 처리에서 실제 사용한다. 빌드에는 제공하지 않는다. 두 개발 테스트 플래그는 운영 파일에서 제거했다. production에서는 코드가 개발 경로를 차단하므로 운영에 이 플래그를 등록할 필요가 없다. 파일 가져오기 후 호스팅에 기존 등록된 테스트 플래그가 남아 있으면 삭제한다.
