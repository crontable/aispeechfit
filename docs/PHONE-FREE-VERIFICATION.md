# 전화번호 제거의 최종 검증 방법

이슈 #32의 8번 검증 명세다. 현재 작업 폴더의 코드로 자동 검사·공개 설정 빌드·실제 HTTP 인증 경계를 확인한다. 운영 DB·계정·Secret·배포 변경은 9번에서 대상을 정하고 10번에서 실행한다.

## 1. 실행 대상과 순서

| 검사 | 실행 대상 | 확인할 결과 |
| --- | --- | --- |
| 인증·접근 자동 검사 | 55432·55433의 기존 로컬 PostgreSQL에서 새 임시 DB를 생성한다. | OAuth·기존 식별자·세션·이용권·RLS·권한 회수·개발 도구가 통과하고 만든 DB·역할만 정리한다. |
| 공개 설정 빌드 | `.env*`를 제외해 복사한 새 임시 작업 폴더다. | 비밀정보 없이 기본 `pnpm build`가 통과한다. |
| 직접 HTTP 검사 | 새 로컬 PostgreSQL·PostgREST 컨테이너와 전용 브리지 네트워크다. | HTTP 서명 검증과 실제 DB 세션·이용권·권한이 함께 적용된다. |

이슈에 지정된 순서로 아래 검사를 실행한다. 첫 실패를 해결한 뒤 다음 검사로 넘어가며 실패·건너뜀을 통과에 포함하지 않는다.

```sh
pnpm test:auth-schema
pnpm test:service-auth
pnpm test:edge-auth
pnpm exec tsc --noEmit
pnpm lint
deno check --frozen --config supabase/functions/service-auth-v1/deno.json supabase/functions/service-auth-v1/index.ts
pnpm test:kakao
pnpm test:auth-migration
pnpm test:auth-tools
pnpm test:public-build
pnpm test:data-api
```

화면·프록시 구현을 바꾼 경우 `pnpm test:auth-ui`로 실제 Next.js 이동·쿠키·오류 상태를 다시 검사한다. 8번에서 애플리케이션의 화면·프록시 코드는 변경하지 않았으며, 7번의 화면 검사 9개 통과 기록을 유지한다.

## 2. 공개 설정 빌드

`scripts/netlify/verify-build.mjs`는 Git 추적 파일과 무시되지 않은 신규 파일을 복사하되 모든 `.env*`를 제외한다. 도구 실행 경로 외에는 `NETLIFY=true`, 텔레메트리 비활성화와 네 공개 설정만 전달한다. `AUTH_FUNCTION_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`는 합성 주소·공개 키 형식의 값이다. 운영 DB URL·카카오 secret·서명 개인 키·관리 토큰을 읽거나 전달하지 않는다.

복사한 작업 폴더에 `pnpm install --offline --frozen-lockfile`을 실행하고 기본 `pnpm build`를 실행한다. 필요한 의존성이 로컬 저장소에 없으면 설치 단계가 실패한다. 실제 프로젝트의 의존성을 준비한 뒤 다시 실행하며 네트워크 설치로 자동 전환하지 않는다. 빌드 출력과 `.next` 생성 결과, 환경 파일 제외를 확인하고 임시 작업 폴더는 성공·실패 모두 정리한다. 안전한 결과 집계는 OS 임시 디렉터리의 `aispeechfit-public-build-result.json`에 남긴다.

## 3. 직접 HTTP 검사

`supabase/verification/access-policy.test.mjs`는 `tests/data-api/fixture.mjs`가 만든 환경만 사용한다. 과거 Supabase Auth 쿠키 해석·이메일 로그인·운영 URL 입력·토큰 누락 시 건너뛰기 기능은 제거했다. 실행마다 새로운 P-256 키 쌍·DB 비밀번호·합성 사용자·계정·세션·이용권을 만든다. 실제 애플리케이션의 `issueDataToken()`으로 ES256 토큰을 발급하고, PostgREST에는 검증용 공개 키만 전달한다.

Docker는 로컬 Unix 소켓이어야 하며 `postgres:17-alpine`과 `public.ecr.aws/supabase/postgrest:v14.13` 이미지가 미리 있어야 한다. 실행 시 이미지를 자동 다운로드하지 않는다. 새 컨테이너 두 개와 전용 브리지 네트워크만 만들고 호스트의 빈 `127.0.0.1` 포트에 게시한다. 기존 컨테이너·볼륨·DB를 초기화하지 않는다. PostgreSQL 자료는 새 컨테이너의 메모리 파일 시스템에 저장한다. 종료 시 이 실행의 고유 표식과 ID를 대조해 두 컨테이너·부속 볼륨·네트워크를 제거한다.

초기 자료 생성에는 새 DB의 postgres 역할을 사용한다. HTTP 서버의 `api_authenticator`는 NOINHERIT 로그인 역할이며 `anon`·`authenticated`로만 역할을 전환할 수 있다. 일반 테이블을 소유하지 않고 RLS를 우회하지 않는다. 인증·public fixture → 기존 정책·실행 역할 → 전화번호 없는 접근 SQL → `provider_account_id` 정정 → 전화번호 권한 회수 순서로 적용한다. 기존 식별 관계가 있는 합성 행도 남겨 전후 전체 행을 비교한다.

| HTTP 검증 범위 | 기대 결과 |
| --- | --- |
| 익명 SELECT·RPC | 권한 오류로 거부한다. |
| 유효 서명·실제 세션·본인 유효 이용권 | 본인 이용권과 학습 자료·중첩 관계 조회를 허용한다. |
| 타인 이용권, 미보유·만료·미개시·비활성 이용권 | 타인 행과 학습 자료를 반환하지 않는다. |
| 서명 변조·다른 키·무서명·쿠키 원문 | PostgREST에서 HTTP 401로 거부한다. |
| 만료·미래 발급·미래 사용 시작 JWT | HTTP 인증 단계에서 거부한다. |
| 잘못된 issuer·role·사용자와 세션 결합 | 역할 전환 또는 DB 세션 검사에서 거부한다. |
| 발급 후 실제 세션 만료·삭제, 이용권 비활성화 | 같은 서명 토큰을 다시 보내도 다음 요청에서 반영한다. |
| 일반 역할의 네 테이블 INSERT·UPDATE·DELETE | 36개의 쓰기 요청을 권한 오류로 거부하고 전체 합성 행을 보존한다. |
| 비공개 인증·보관 스키마, 구 boolean RPC | 노출하지 않는다. |

PostgREST 14는 JWT 시각 검증에 30초의 시계 오차를 허용하므로 만료·미래 시각 검사는 그 범위를 넘긴 값으로 수행한다. 앱의 토큰 발급 코드가 기록하는 유효 기간은 최대 60초다. 실제 세션 만료·삭제는 별도로 DB가 매 요청마다 검사한다. [PostgREST 14 인증 명세](https://docs.postgrest.org/en/v14/references/auth.html), [JWK 및 역할 설정 명세](https://docs.postgrest.org/en/v14/references/configuration.html)를 따른다.

## 4. 증거의 적용 범위와 남은 확인

이번 HTTP 검사는 실제 PostgREST·PostgreSQL의 서명 검증·역할 전환·SQL 정책에 대한 증거다. Supabase 운영 API gateway의 publishable 키 처리, 실제 프로젝트의 서명 키 등록·함수 설정·플랫폼 버전, Netlify 배포, 카카오 원본 앱·일반 사용자·실기기 복귀는 10번에서 별도로 확인한다. 로컬 결과를 운영 배포 완료로 기록하지 않는다.

8번 첫 HTTP 실행에서는 `--internal` 네트워크의 컨테이너가 실행 중인데도 호스트 포트가 게시되지 않았다. 상태 메타데이터에서 요청한 포트 바인딩과 실제 빈 매핑을 확인했고, 전용 브리지 네트워크의 루프백 포트 게시로 바꿔 해결했다. 새 Node 실행 도구의 `.ts` import에는 기존 검사 디렉터리와 같은 ESLint 확장자 규칙을 적용했다. 실패·진단·수정 후 로그를 구분해 보존한다.
