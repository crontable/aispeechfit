# Supabase Edge 인증 배포 명세

Netlify는 화면 렌더링과 고정 경로 프록시를 실행한다. Supabase의 `service-auth-v1`이 Better Auth, 세션과 이용권 확인, 학습 데이터 조회를 실행한다. DB·시크릿·서명 키를 Netlify에 전달하지 않는다.

## 배포 입력

함수의 `deno.json`과 `deno.lock`을 함께 사용한다. `supabase/config.toml`에 함수별 `verify_jwt=false`를 선언하며, 보호 경로에서는 별도로 Better Auth 실제 세션·본인 이용권을 검증한다. DB 연결에는 기존 실행 역할과 TLS 인증서 검증을 유지한다.

PR #30 검증 주소는 `https://deploy-preview-30--aispeechfit.netlify.app`이며 `service-auth-preview-v1`을 사용한다. 운영은 `https://aispeechfit.crontables.com`과 `service-auth-v1`을 사용한다. 두 진입점은 동일한 공유 구현·의존성을 참조하고 정확한 Origin·함수 이름만 다르다. 검증 함수의 Origin은 PR #30으로 한정하며 다른 미리보기 주소를 자동 허용하지 않는다.

공개 URL `BETTER_AUTH_URL`, `AUTH_FUNCTION_URL`과 Netlify가 제공하는 배포 고유 주소 `DEPLOY_URL`은 `next.config.ts`에서 빌드 값으로 고정한다. Netlify는 일부 요청을 고유 주소로 전달하므로 그 배포 주소와 서비스 Origin만 허용하며 다른 배포나 임의 전달 헤더는 신뢰하지 않는다. 비밀정보를 이 목록에 추가하지 않는다. OAuth callback은 쿠키와 함께 스크립트 없는 HTML refresh를 반환한다. 실제 Netlify에서는 303에도 인증 코드·state가 다음 주소로 전달되어, 정확한 완료 주소로 이동하는 방식을 사용한다.

Supabase Management API의 `POST /v1/projects/{ref}/functions/deploy`에 `slug`와 multipart form을 전달한다. `metadata`는 함수 이름, `entrypoint_path`, `import_map_path`, `verify_jwt`를 담는다. 각 소스 파일을 `file` 항목으로 넣고 상대 경로를 파일 이름으로 보존한다. `.env*`와 저장소 전체는 업로드하지 않는다. `bundleOnly=1`로 먼저 실제 플랫폼 번들을 검사한다.

관리 토큰은 로컬 `.env.local`에서 읽고 Authorization 헤더에만 사용한다. Function Secrets 등록 목록은 [환경 변수 명세](./NETLIFY-ENV.md)의 일곱 항목으로 제한한다. Supabase Secrets는 프로젝트 단위이므로 검증·운영 Origin은 각 함수 진입점에 고정하고 비밀정보를 서로 덮어쓰지 않는다.

## 이슈 32의 검증 및 공개 순서

1. 8번에서 OAuth·DB·Edge·UI 자동 검사, 타입·린트·Deno 검사, 비밀정보 없는 공개 설정 빌드와 Data API 직접 HTTP 검증을 실행한다. DB 자동 검사는 localhost의 임시 DB만 사용한다.
2. 9번에서 실제 PR 번호와 검증 Origin·함수·DB를 확인한다. 위 PR #30 주소는 기존 설정이며 새 이슈 번호를 preview 번호로 사용하지 않는다. Supabase Secrets의 프로젝트 단위 영향, Netlify 자동 배포, 카카오 callback과 원본 앱 식별 관계를 확인한다.
3. 계정·이용권·식별 관계와 폐기 대상·백업·복원·적용자를 정한 뒤 10번의 전환 구간에서 요청을 제한한다. `20260913040000_phone_free_access.sql` → `20260913050000_rename_provider_account_id.sql`과 이에 맞는 새 Edge·Next.js 릴리스를 적용한다. 기존 `account_id` 매핑과 새 DB 열을 혼합하지 않는다.
4. `/health` 200, 익명 access, 쿠키 없는 자료 401, 외부 Origin 403, 제거 API 404를 확인한다. 실제 카카오 로그인 → 학습/이용권 안내 → 챕터 → 새로고침 → 로그아웃 → 재로그인과 code·state 제거를 검증한다. `/api/kakao/verify`, `/api/dev/kakao/verify`가 수집 경로로 남지 않아야 한다.
5. 구버전 전화번호 함수와 연결이 없을 때 [운영 정리 명세](./PHONE-REMOVAL-OPERATIONS.md)의 권한 회수 SQL과 Secret 정리를 수행한다. 기존 개인정보는 확정된 범위에 따라 별도로 폐기한다.
6. 원본 앱의 일반 사용자, iOS·Android 카카오톡 공유 링크에서 로그인·복귀를 실제 확인한다. 적용 Git SHA·DB SQL·Edge 버전·Netlify deploy ID·검증 환경과 결과를 이슈 #32에 기록한다. 실기기 결과 전에는 모바일 검증을 완료로 표시하지 않는다.

위 순서는 계획이며 이 문서 변경으로 배포·운영 SQL·Secret 삭제가 실행되지는 않는다. 요청 제한과 재개, 호환 릴리스와 원본 앱 확인이 준비되기 전에는 전환을 실행하지 않는다.

## 복구

DB·이용권·키를 재이관하거나 회전하지 않는다. 이슈 #32의 열 정정은 DB와 Edge를 함께 복원해야 하며 [4번 SQL 명세](./PHONE-REMOVAL-S3.md)를 따른다. 전화번호 자료·권한을 폐기한 뒤에는 예전 전화번호 확인 릴리스를 그대로 복원할 수 없으므로 9번에서 별도 복원 기준을 확정한다. 오류가 생기면 준비된 호환 Netlify deploy ID와 Edge 함수 URL 조합으로 되돌린다. 정상 조합이 없는 최초 이전에서는 자동 공개 잠금을 유지하고 `/service-unavailable` 안내와 보호 API의 안전한 503 응답을 사용한다. 잘못된 인증·이용권 상태를 정상으로 취급해 자료를 공개하지 않는다.

`/health` 성공은 DB 연결과 설정 준비를 확인하는 증거다. 실제 카카오 로그인, 개인별 RLS, 모바일 카카오톡 복귀 성공을 대신하지 않는다. 실기기 결과를 얻기 전에는 모바일 검증을 완료로 표시하지 않는다.
