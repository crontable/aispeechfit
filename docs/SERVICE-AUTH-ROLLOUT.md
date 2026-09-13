# 카카오 서비스 로그인과 데이터 연결

2026년 9월 13일 기준 기존 Better Auth 스키마와 실행 역할은 운영 Supabase에 적용되어 있다. 본인 카카오 계정 한 개와 유효 이용권 한 개가 연결되어 있으며, 이전 `auth.users`와 만료 이용권을 다시 이관하지 않는다. 원본 이용권 기록은 비공개 `auth_source.tickets`에 보존한다.

`better_auth_runtime`은 인증 기본 테이블을 처리하고, `better_auth_phone_writer`만 신뢰 전화번호와 세션 확인 기록을 수정한다. 일반 프로필 수정 API에는 전화번호 필드를 허용하지 않는다. 사용자 ID·실제 세션·카카오 전화번호 확인 버전·이용권 기간을 기존 RLS에서 함께 확인한다.

## 실행 위치 이전

이슈 #29에서 인증·전화번호 확인·JWT 발급·학습 조회를 Supabase Edge Functions로 옮긴다. Netlify는 공개 설정과 동일 출처 프록시를 사용한다. 운영 복구가 완료됐는지는 [이슈 #29](https://github.com/crontable/aispeechfit/issues/29)의 실제 동선 검사로 판단한다.

이전 단계의 `auth-schema:cutover`는 최초 선택 이용권 연결용 관리 도구다. 이번 Edge 배포에서는 다시 실행하지 않는다. 기존 서명 키의 이름은 `DATA_API_SIGNING_JWK`로 맞추되 내용·식별자를 유지한다.

## 검증과 참조

`pnpm test:service-auth`는 격리된 로컬 DB에서 세션·이용권·RLS와 기존 선택 이용권 전환 도구를 검증한다. `pnpm test:edge-auth`는 Edge 요청 경계, 프록시 쿠키, 서명, 분산 요청 제한과 역할을 검증한다. 실제 OAuth·운영 DB·Supabase Runtime 검증은 별도로 기록한다.

- [환경 변수 보관 위치](./NETLIFY-ENV.md)
- [Edge 배포·복구 절차](./EDGE-AUTH-ROLLOUT.md)
- [최초 인증 이슈 #20](https://github.com/crontable/aispeechfit/issues/20)
