# 카카오 서비스 로그인과 데이터 연결

이슈 #32의 현재 구현은 Better Auth 실제 세션과 본인 유효 이용권으로 학습을 허용한다. 전화번호 수집·검증·세션별 재확인을 요구하지 않는다. 운영 DB와 배포 반영 상태는 [이슈 #32 체크리스트](https://github.com/crontable/aispeechfit/issues/32)에 따로 기록한다.

## 요청과 권한

브라우저는 `/sign-in`에서 카카오 로그인을 시작하고 Next.js `/api/auth` 프록시가 Supabase Edge Function으로 전달한다. 성공 후 `/auth/complete`가 세션·이용권을 확인하여 `/study` 또는 `/unauthorized`로 이동한다. 세션이 없으면 `/sign-in`, 서비스 응답 장애이면 `/service-unavailable`로 이동한다. 완료 URL에 code·state를 남기지 않는다.

Edge의 `better_auth_runtime` 연결은 인증 기본 테이블과 공유 요청 제한을 처리한다. 전화번호 전용 연결을 만들지 않는다. Data API에는 최대 60초 ES256 토큰을 전달하며 `sub`와 `session_id`를 실제 세션과 대조하고 RLS가 본인 이용권과 학습 자료를 제한한다. 기존 이용권 기간·소유권·활성 상태와 비공개 `auth_source.tickets`는 보존한다.

## 전환 조건

새 Edge 매핑은 `accounts.provider_account_id`를 읽으므로 기존 `account_id`를 쓰는 운영 DB와 혼합 배포하면 계정 조회가 실패한다. 이슈 9번에서 전환 구간·백업·호환 릴리스·복원을 정하고 10번에서 접근 SQL → 열 정정 → Edge·Next.js 릴리스를 함께 적용한다. 그 뒤 전화번호 전용 권한·Secret을 정리한다. [4번 DB 명세](./PHONE-REMOVAL-S3.md)와 [7번 운영 정리 명세](./PHONE-REMOVAL-OPERATIONS.md)를 따른다.

기존 `auth-schema:cutover`는 최초 선택 이용권 이전용 도구였으며 사용을 종료했다. 현재 사용자·계정·이용권을 다시 이관하거나 서명 키를 회전하지 않는다.

## 검증 범위

`pnpm test:service-auth`는 격리 DB의 세션·이용권·RLS·권한 회수와 과거 이용권 전환 SQL의 복원 회귀를 검사한다. `pnpm test:edge-auth`는 실제 Better Auth·프록시 쿠키·서명·분산 호출 제한·역할을 검사한다. `pnpm test:auth-ui`는 합성 Edge 응답과 실제 Next.js로 화면 이동을 검사한다. Data API 직접 HTTP 검사는 8번, 실제 원본 앱·비테스터·iOS·Android 카카오톡 복귀는 10번의 별도 증거가 필요하다.

환경 변수는 [Netlify 명세](./NETLIFY-ENV.md), 배포 순서는 [Edge 명세](./EDGE-AUTH-ROLLOUT.md)를 따른다.
