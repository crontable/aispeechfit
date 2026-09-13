# 데이터 접근 정책

이슈 #32의 현재 코드는 Better Auth 실제 세션과 본인 이용권을 연결한다. 브라우저·Next.js는 동일 출처 서비스 프록시를 사용하고, Supabase Edge가 세션별 단기 서명 토큰으로 Data API에 접근한다. `proxy.ts`는 경로 이동을 안내하며 보호 API·페이지·DB가 접근을 다시 검사한다. 운영 적용 상태는 [이슈 #32](https://github.com/crontable/aispeechfit/issues/32)에 기록한다.

## 키의 용도

| 값 | 어디에 있는가 | 무엇을 하는가 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 번들, 서버 | 프로젝트 주소다. 비밀이 아니다 |
| `NEXT_PUBLIC_SUPABASE_KEY` | 공개 설정, Edge Data API | publishable 키다. 키만 보내면 `anon`, 유효한 세션별 서명 토큰을 함께 보내면 `authenticated` 역할로 요청한다. 비밀이 아니다 |
| secret / `service_role` 키 | 사용하지 않는다 | RLS를 우회하는 서버 전용 자격이다. Edge의 Data API 클라이언트는 publishable 키와 최대 60초 세션별 서명 토큰을 사용한다 |

공개 키가 알려져도 접근 범위는 아래 정책이 지킨다. 키 교체는 보호 수단이 아니다.

## 역할별 허용 범위

| 테이블 | `anon` (비로그인) | `authenticated`, 유효 이용권 없음 | `authenticated`, 유효 이용권 있음 | 쓰기 (INSERT·UPDATE·DELETE) |
| --- | --- | --- | --- | --- |
| `tickets` | 권한 없음 | 본인 행 SELECT | 본인 행 SELECT | 모든 일반 역할 차단 |
| `books` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |
| `chapters` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |
| `questions` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |

"권한 없음"은 GRANT가 없어 권한 오류(42501)가 나는 상태이고, "0행"은 SELECT 권한은 있으나 RLS 정책이 모든 행을 거르는 상태다. 유효 세션이 없으면 `authenticated`라도 본인 이용권과 학습 자료를 읽지 못한다. 응답이 다르므로 검증할 때 구분한다.

학습 자료와 이용권의 추가·수정·삭제는 Supabase 대시보드(`postgres` 역할)에서만 한다. `postgres`는 테이블 소유자라 RLS를 거치지 않는다.

## 유효 이용권 조건

Data API가 서명·JWT 만료를 검증한 뒤 `public.has_valid_auth_session()`이 issuer·role·사용자 UUID·세션 UUID를 실제 `better_auth.sessions`와 대조한다. 세션 만료는 `expires_at > now()`로 검사하며 삭제·철회된 세션은 즉시 거부한다. 전화번호·identity·확인 버전은 접근 조건에서 제외한다.

`public.has_active_ticket()`은 유효한 실제 세션과 함께 아래 이용권 조건을 요구한다.

1. `tickets.user_id`가 요청 사용자(`auth.uid()`)와 같다.
2. `is_active = true`다.
3. DB 시각 `now()`가 `started_at` 이상이고 `expires_at` 이하다. 경계 시각을 포함한다.
4. 위 조건을 만족하는 행이 하나 이상 있다.

시각 열은 모두 `timestamptz`이고 DB 세션 시간대는 UTC다. 판정은 요청 시점마다 다시 하므로 이용권을 바꾸면 다음 요청부터 반영된다. 이미 발급된 세션 토큰을 회수할 필요가 없다.

함수는 `security invoker`다. `tickets`의 본인 행 정책 안에서만 읽으므로 남의 이용권을 보지 못하고, 학습 자료 정책을 참조하지 않아 정책 순환이 없다. 실행 권한은 `authenticated`에만 있다.

## 정책 목록

| 테이블 | 정책 이름 | 명령 | 조건 |
| --- | --- | --- | --- |
| `tickets` | Allow read own tickets | SELECT | `user_id = auth.uid()` |
| `books` | Select learning data with active ticket | SELECT | `has_active_ticket()` |
| `chapters` | Select learning data with active ticket | SELECT | `has_active_ticket()` |
| `questions` | Select learning data with active ticket | SELECT | `has_active_ticket()` |

위 SELECT 정책에는 `Require Better Auth session`이라는 RESTRICTIVE 정책을 함께 적용한다. 세션 함수는 제한된 `security definer`와 고정 `search_path=pg_catalog`를 사용한다. 4번 변경과 운영의 적용 여부는 [SQL 명세](./PHONE-REMOVAL-S3.md)를 따른다. 인증 기본 역할은 전화번호 테이블을 읽을 필요가 없으며 기존 전용 역할·권한은 [7번 운영 정리 명세](./PHONE-REMOVAL-OPERATIONS.md)에 따라 회수한다.

## 새 테이블·뷰·함수를 만들 때

`postgres` 역할이 `public`에 만드는 테이블·시퀀스·함수의 기본 권한을 거두어 두었으므로, 대시보드·SQL Editor·CLI로 새로 만든 객체에는 `anon`·`authenticated` 권한이 자동으로 붙지 않는다. `supabase_admin` 역할의 기본 권한은 플랫폼 초기값이라 바꿀 수 없으며, 그 역할로 만든 객체가 생기면 `supabase/verification/access-policy.sql` 3번 질의로 권한을 확인한다. 앱에서 읽으려면 마이그레이션에 아래를 함께 적는다.

1. `alter table ... enable row level security;`
2. 필요한 명령만 `grant select on ... to authenticated;`
3. 허용 행을 정하는 `create policy ...`
4. `supabase/verification/access-policy.sql`의 기대 결과를 갱신한다.

`security definer` 함수와 뷰는 테이블 정책을 우회할 수 있다. 만들 때 실행 권한과 반환 범위를 따로 확인한다.

## 기록하지 않는 것

이슈, 커밋, 문서, 로그에 키 원문, 사용자 토큰, 사용자 ID, 이메일, 이용권 원문을 적지 않는다. 검증 결과는 자격 유형·테이블·작업·상태 코드·허용 행 수로 적는다.

## 직접 HTTP 검증

`pnpm test:data-api`는 새 로컬 PostgreSQL·PostgREST와 실행마다 생성한 서명 키·합성 자료로 위 허용 범위를 검사한다. 실제 세션 철회·만료·이용권 변경과 HTTP 서명 거부를 함께 확인하며, 일반 역할의 거부 예상 쓰기도 이 환경에서만 실행한다. 운영 Supabase gateway와 실제 계정 검증은 별도 절차다. [8번 검증 명세](./PHONE-FREE-VERIFICATION.md)를 따른다.
