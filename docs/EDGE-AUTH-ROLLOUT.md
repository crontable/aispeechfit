# Supabase Edge 인증 배포 명세

Netlify는 화면 렌더링과 고정 경로 프록시를 실행한다. Supabase의 `service-auth-v1`이 Better Auth, 카카오 전화번호 검증, 세션과 이용권 확인, 학습 데이터 조회를 실행한다. DB·시크릿·서명 키를 Netlify에 전달하지 않는다.

## 배포 입력

함수의 `deno.json`과 `deno.lock`을 함께 사용한다. `supabase/config.toml`에 함수별 `verify_jwt=false`를 선언하며, 보호 경로에서는 별도로 Better Auth 세션·전화번호·이용권을 검증한다. DB 연결에는 기존 실행 역할과 TLS 인증서 검증을 유지한다.

PR #30 검증 주소는 `https://deploy-preview-30--aispeechfit.netlify.app`이며 `service-auth-preview-v1`을 사용한다. 운영은 `https://aispeechfit.crontables.com`과 `service-auth-v1`을 사용한다. 두 진입점은 동일한 공유 구현·의존성을 참조하고 정확한 Origin·함수 이름만 다르다. 검증 함수의 Origin은 PR #30으로 한정하며 다른 미리보기 주소를 자동 허용하지 않는다.

Supabase Management API의 `POST /v1/projects/{ref}/functions/deploy`에 `slug`와 multipart form을 전달한다. `metadata`는 함수 이름, `entrypoint_path`, `import_map_path`, `verify_jwt`를 담는다. 각 소스 파일을 `file` 항목으로 넣고 상대 경로를 파일 이름으로 보존한다. `.env*`와 저장소 전체는 업로드하지 않는다. `bundleOnly=1`로 먼저 실제 플랫폼 번들을 검사한다.

관리 토큰은 로컬 `.env.local`에서 읽고 Authorization 헤더에만 사용한다. Function Secrets 등록 목록은 [환경 변수 명세](./NETLIFY-ENV.md)의 아홉 항목으로 제한한다. Supabase Secrets는 프로젝트 단위이므로 검증·운영 Origin은 각 함수 진입점에 고정하고 비밀정보를 서로 덮어쓰지 않는다.

## 검증 및 공개 순서

1. `pnpm test:edge-auth`, `pnpm test:service-auth`, 타입 검사, 린트, `deno check`를 통과한다. DB 테스트는 `localhost:55433`의 격리 DB만 사용한다.
2. `.env.local`이 없는 별도 작업 공간에서 공개 설정만으로 `pnpm build`를 실행한다. Next.js 산출물과 Netlify 등록 변수에 비밀정보가 없는지 확인한다.
3. 최초 배포에서만 `20260913030000_edge_request_limits.sql`을 적용한다. 인증·전화번호·이용권을 변경하지 않는 추가 테이블이다. 적용 전후 기존 행의 해시를 비교한다.
4. 버전별 Edge 후보를 배포한다. `/health` 200, 익명 access, 쿠키 없는 자료 접근 401, 외부 Origin 403, 금지 API 404, 카카오 시작 응답을 확인한다. JWT와 OAuth 토큰 값은 로그에 남기지 않는다.
5. Netlify 자동 공개를 잠그고 고정 HTTPS 검증 배포를 준비한다. 정확한 callback을 카카오 개발 앱에 등록하고 실제 계정으로 로그인·전화번호 확인·이용권·챕터·새로고침·로그아웃·재로그인을 검증한다.
6. 검증된 코드의 운영 Origin 함수와 Netlify 배포 조합을 공개한다. 운영 도메인에서 같은 동선을 확인하고 Git SHA·Netlify deploy ID·Edge 버전과 결과를 이슈 #29의 통합 코멘트에 기록한다.

## 복구

DB·이용권·키를 재이관하거나 회전하지 않는다. 오류가 생기면 준비된 호환 Netlify deploy ID와 Edge 함수 URL 조합으로 되돌린다. 정상 조합이 없는 최초 이전에서는 자동 공개 잠금을 유지하고 `/service-unavailable` 안내와 보호 API의 안전한 503 응답을 사용한다. 잘못된 인증·이용권 상태를 정상으로 취급해 자료를 공개하지 않는다.

`/health` 성공은 DB 연결과 설정 준비를 확인하는 증거다. 실제 카카오 로그인, 개인별 RLS, 모바일 카카오톡 복귀 성공을 대신하지 않는다. 실기기 결과를 얻기 전에는 모바일 검증을 완료로 표시하지 않는다.
