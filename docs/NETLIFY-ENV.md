# 공개 설정과 로컬 비밀정보

`.env`는 공개 설정만 담고, `.env.local`은 비밀정보와 로컬 덮어쓰기를 담는다. 두 파일과 예제의 키는 알파벳순으로 정렬한다. 실제 환경 파일은 Git에 포함하지 않는다.

| 위치 | 저장할 항목 |
| --- | --- |
| `.env` 및 Netlify | `AUTH_FUNCTION_URL`, `BETTER_AUTH_URL`, `KAKAO_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |
| `.env.local` 및 Supabase Function Secrets | `AUTH_DATABASE_URL`, `BETTER_AUTH_SECRET`, `DATA_API_SIGNING_JWK`, `KAKAO_CLIENT_SECRET` |
| `.env.local`만 | 관리자 DB 연결, 마이그레이션·개발 DB 연결과 비밀번호, `SUPABASE_ACCESS_TOKEN`, `NETLIFY_AUTH_TOKEN` |

Supabase 함수의 현재 필수 입력은 알파벳순으로 `AUTH_DATABASE_URL`, `BETTER_AUTH_SECRET`, `DATA_API_PUBLIC_KEY`, `DATA_API_SIGNING_JWK`, `DATA_API_URL`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`의 일곱 개다. 이 중 DB 연결·인증 secret·서명 개인 키·카카오 client secret 네 개는 비밀정보다. Data API URL·키는 공개 Supabase 주소·publishable 키를 사용하며 `service_role`과 `sb_secret_` 키를 허용하지 않는다.

`KAKAO_APP_ID`는 전화번호의 토큰 발급 앱 확인과 종료한 관리 도구에서만 사용했으므로 현재 설정에서 제거했다. DB의 기존 `kakao_identities.app_id`는 계정 출처로 보존한다. `AUTH_PHONE_DATABASE_URL`도 새 함수가 읽지 않는다. 실제 운영·로컬의 두 값 삭제는 이슈 #32의 9번에서 전체 참조를 확인하고 10번에서 수행한다. Netlify의 금지 비밀정보 검사에는 과거 전화번호 DB URL을 계속 포함한다.

`DATA_API_SIGNING_JWK`는 이전 `SUPABASE_DATA_SIGNING_JWK`의 이름을 바꾼 항목이다. Supabase의 사용자 지정 secret에는 `SUPABASE_` 접두사를 사용할 수 없기 때문이다. 키 내용과 `kid`는 유지하며 키 회전은 수행하지 않는다.

## 업로드 경계

`.env`는 공개 설정 가져오기에 사용할 수 있다. `.env.local` 전체를 업로드하거나 파일 내용을 Netlify 환경 변수에 복사하지 않는다. Supabase에도 등록 목록 일곱 개만 전달하며, 관리자·관리 토큰은 제외한다. 관리 토큰이 만료되어도 이미 배포된 함수 실행에는 영향이 없다.

Netlify 빌드는 공개 함수 URL과 서비스 Origin을 검사하고 알려진 인증 비밀정보가 전달되면 실패한다. 실제 배포에서는 Netlify API로 등록 항목·범위를 조회하고, 비밀정보를 주입하지 않은 별도 디렉터리에서 빌드·산출물을 검사한다.

## 서비스 주소

`BETTER_AUTH_URL`은 쿠키와 카카오 callback의 기준이 되는 정확한 서비스 Origin이다. 운영 값은 `https://aispeechfit.crontables.com`이다. `AUTH_FUNCTION_URL`은 `/functions/v1/service-auth-v1`까지의 Supabase 함수 URL이다. 검증용 함수는 별도 고정 HTTPS Origin을 사용한다. 사용자 입력·요청 헤더로 허용 출처를 확장하지 않는다.

현재 구현과 검증·전환 상태는 [Edge 배포 절차](./EDGE-AUTH-ROLLOUT.md)와 [이슈 #32](https://github.com/crontable/aispeechfit/issues/32)에 기록한다.

로컬 `KAKAO_AUTH_TEST_ENABLED`는 별도 OAuth 검사와 개발 진입 경로에만 사용한다. Next.js `/api/auth`는 항상 설정된 Edge 프록시다. `EDGE_LOCAL_TEST`는 합성 로컬 HTTP 검사에 한정하며 운영 함수의 Origin·TLS 검사를 완화하는 배포 설정으로 사용하지 않는다. 자세한 대상 구분은 [개발 검사 명세](./KAKAO-AUTH-TEST.md)를 따른다.
