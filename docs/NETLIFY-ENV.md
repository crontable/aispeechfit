# 로컬 설정과 Netlify 운영 설정

Better Auth는 Netlify Functions에서 실행되며 Supabase PostgreSQL에 연결한다. 환경 파일은 아래 두 용도로 나눈다. 두 파일 모두 비밀 값이 있으므로 Git에서 제외한다.

| 파일 | 용도 | 포함 항목 |
| --- | --- | --- |
| `.env.local` | 로컬 개발·DB 관리. Netlify에 업로드하지 않는다. | 개발 설정, 관리·마이그레이션 계정, 로컬 실행에 필요한 서비스 설정 |
| `.env.remote` | Netlify Production 환경 변수 가져오기 전용 | 운영 서비스가 필요한 13개 설정만 포함 |

로컬 작업에도 서비스 계정이 필요하므로 일부 항목은 양쪽에 존재한다. 관리자 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`, 로컬 DB 비밀번호, 마이그레이션 설정은 운영 파일로 복사하지 않는다.

## 운영 파일 생성

```sh
pnpm env:remote
```

이 명령은 `.env.local`을 수정하지 않는다. 정해진 항목만 읽어 `.env.remote`을 생성하고, 운영 주소를 `https://aispeechfit.crontables.com`으로 지정한다. DB 계정이 각각 `better_auth_runtime`, `better_auth_phone_writer`인지 확인하며, 관리자 계정이 들어오면 생성을 중단한다. 비밀 값은 출력하지 않으며 생성 파일은 소유자만 읽고 쓸 수 있다.

운영 항목은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `AUTH_DATABASE_URL`, `AUTH_PHONE_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_APP_ID`, `SUPABASE_DATA_SIGNING_JWK`, `BETTER_AUTH_DATA_API_READY`, `KAKAO_AUTH_TEST_ENABLED`, `KAKAO_REMOTE_AUTH_TEST_ENABLED`이다. 두 테스트 플래그는 항상 `false`로 내보낸다. Data API 준비 플래그는 원본의 검증 완료 상태를 유지한다.

## Netlify 적용

1. Netlify 프로젝트의 **Project configuration → Environment variables → Import from a .env file**에서 `.env.remote`을 가져온다. 파일을 사이트의 공개 파일이나 저장소에 올리지 않는다.
2. **Production** 배포 환경에 적용한다. 범위를 선택할 수 있으면 **Builds와 Functions**를 포함한다. 현재 빌드 검증과 실행 서버가 모두 설정을 사용한다.
3. 비밀 값 표시 기능을 사용할 수 있으면 DB URL, Better Auth secret, Kakao client secret, 서명 JWK에 **Contains secret values**를 지정한다.
4. 기존 환경 변수에 관리자 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`이 등록돼 있다면 제거한다. 파일 가져오기는 기존의 불필요한 항목을 자동 삭제하지 않는다.
5. 환경 변수를 저장한 뒤 Production 배포를 다시 실행한다. 새 배포에서 `/`가 `/sign-in`으로 이동하고, 실제 카카오 로그인과 이용권 조회까지 확인한다.

카카오 앱의 운영 Redirect URI는 `https://aispeechfit.crontables.com/api/auth/callback/kakao`이다. 빌드 성공만으로 카카오 로그인이나 DB 연결 성공이 확인되지는 않는다.

참고 문서: [Netlify 환경 변수 가져오기](https://docs.netlify.com/build/environment-variables/get-started/), [Functions 환경 변수](https://docs.netlify.com/build/functions/environment-variables/).
