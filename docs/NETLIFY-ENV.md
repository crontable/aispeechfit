# 공개 설정과 로컬 비밀정보

`.env`는 공개 설정만 담고, `.env.local`은 비밀정보와 로컬 덮어쓰기를 담는다. 두 파일과 예제의 키는 ABC 순으로 정렬한다. 실제 환경 파일은 Git에 포함하지 않는다.

| 위치 | 저장할 항목 |
| --- | --- |
| `.env` 및 Netlify | `AUTH_FUNCTION_URL`, `BETTER_AUTH_URL`, `KAKAO_APP_ID`, `KAKAO_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |
| `.env.local` 및 Supabase Function Secrets | `AUTH_DATABASE_URL`, `AUTH_PHONE_DATABASE_URL`, `BETTER_AUTH_SECRET`, `DATA_API_SIGNING_JWK`, `KAKAO_CLIENT_SECRET` |
| `.env.local`만 | 관리자 DB 연결, 마이그레이션·개발 DB 연결과 비밀번호, `SUPABASE_ACCESS_TOKEN`, `NETLIFY_AUTH_TOKEN` |

Supabase 함수에는 위 실행 비밀정보 다섯 개와 `KAKAO_APP_ID`, `KAKAO_CLIENT_ID`, `DATA_API_URL`, `DATA_API_PUBLIC_KEY`를 선택적으로 등록한다. 마지막 두 값은 공개 `.env`의 Supabase URL·키와 같다. 공개 키에는 `service_role` 또는 `sb_secret_` 키를 사용하지 않는다.

`DATA_API_SIGNING_JWK`는 이전 `SUPABASE_DATA_SIGNING_JWK`의 이름을 바꾼 항목이다. Supabase의 사용자 지정 secret에는 `SUPABASE_` 접두사를 사용할 수 없기 때문이다. 키 내용과 `kid`는 유지하며 키 회전은 수행하지 않는다.

## 업로드 경계

`.env`는 공개 설정 가져오기에 사용할 수 있다. `.env.local` 전체를 업로드하거나 파일 내용을 Netlify 환경 변수에 복사하지 않는다. Supabase에도 등록 목록 아홉 개만 전달하며, 관리자·관리 토큰은 제외한다. 관리 토큰이 만료되어도 이미 배포된 함수 실행에는 영향이 없다.

Netlify 빌드는 공개 함수 URL과 서비스 Origin을 검사하고 알려진 인증 비밀정보가 전달되면 실패한다. 실제 배포에서는 Netlify API로 등록 항목·범위를 조회하고, 비밀정보를 주입하지 않은 별도 디렉터리에서 빌드·산출물을 검사한다.

## 서비스 주소

`BETTER_AUTH_URL`은 쿠키와 카카오 callback의 기준이 되는 정확한 서비스 Origin이다. 운영 값은 `https://aispeechfit.crontables.com`이다. `AUTH_FUNCTION_URL`은 `/functions/v1/service-auth-v1`까지의 Supabase 함수 URL이다. 검증용 함수는 별도 고정 HTTPS Origin을 사용한다. 사용자 입력·요청 헤더로 허용 출처를 확장하지 않는다.

현재 구현과 검증·전환 상태는 [Edge 배포 절차](./EDGE-AUTH-ROLLOUT.md)와 [이슈 #29](https://github.com/crontable/aispeechfit/issues/29)에 기록한다.
