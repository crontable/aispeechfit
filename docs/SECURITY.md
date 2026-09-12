# 데이터 접근 정책

이 문서는 Supabase Data API에 직접 요청해도 지켜지는 접근 범위를 적는다. 앱의 미들웨어(`utils/supabase/middleware.ts`)는 화면 이동만 담당하고, 허용 범위는 DB의 권한과 RLS 정책이 정한다. 이슈 #26에서 정했다.

## 키의 용도

| 값 | 어디에 있는가 | 무엇을 하는가 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 번들, 서버 | 프로젝트 주소다. 비밀이 아니다 |
| `NEXT_PUBLIC_SUPABASE_KEY` | 브라우저 번들, 서버 | publishable 키다. 로그인 전에는 `anon`, 로그인 뒤 사용자 토큰을 함께 보내면 `authenticated` 역할로 요청한다. 비밀이 아니다 |
| secret / `service_role` 키 | 사용하지 않는다 | RLS를 우회하는 서버 전용 자격이다. 이 앱의 서버 클라이언트도 publishable 키와 사용자 쿠키로만 동작한다 |

공개 키가 알려져도 접근 범위는 아래 정책이 지킨다. 키 교체는 보호 수단이 아니다.

## 역할별 허용 범위

| 테이블 | `anon` (비로그인) | `authenticated`, 유효 이용권 없음 | `authenticated`, 유효 이용권 있음 | 쓰기 (INSERT·UPDATE·DELETE) |
| --- | --- | --- | --- | --- |
| `tickets` | 권한 없음 | 본인 행 SELECT | 본인 행 SELECT | 모든 일반 역할 차단 |
| `books` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |
| `chapters` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |
| `questions` | 권한 없음 | 0행 | 전체 SELECT | 모든 일반 역할 차단 |

"권한 없음"은 GRANT가 없어 권한 오류(42501)가 나는 상태이고, "0행"은 SELECT 권한은 있으나 RLS 정책이 모든 행을 거르는 상태다. 응답이 다르므로 검증할 때 구분한다.

학습 자료와 이용권의 추가·수정·삭제는 Supabase 대시보드(`postgres` 역할)에서만 한다. `postgres`는 테이블 소유자라 RLS를 거치지 않는다.

## 유효 이용권 조건

`public.has_active_ticket()` 함수가 판정한다. 미들웨어와 `/unauthorized` 화면의 조회 조건과 같다.

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

## 새 테이블·뷰·함수를 만들 때

`public` 스키마의 기본 권한을 거두어 두었으므로, 새로 만든 테이블·시퀀스·함수에는 `anon`·`authenticated` 권한이 자동으로 붙지 않는다. 앱에서 읽으려면 마이그레이션에 아래를 함께 적는다.

1. `alter table ... enable row level security;`
2. 필요한 명령만 `grant select on ... to authenticated;`
3. 허용 행을 정하는 `create policy ...`
4. `supabase/verification/access-policy.sql`의 기대 결과를 갱신한다.

`security definer` 함수와 뷰는 테이블 정책을 우회할 수 있다. 만들 때 실행 권한과 반환 범위를 따로 확인한다.

## 기록하지 않는 것

이슈, 커밋, 문서, 로그에 키 원문, 사용자 토큰, 사용자 ID, 이메일, 이용권 원문을 적지 않는다. 검증 결과는 자격 유형·테이블·작업·상태 코드·허용 행 수로 적는다.
