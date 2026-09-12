-- 이슈 #26: 공개 키의 직접 접근을 RLS로 제한하고 이용권에 따른 학습 자료 접근을 보장한다
--
-- 적용 전 상태 (2026. 09. 12. SQL Editor 확인)
--   - 4개 테이블 모두 RLS 활성. anon 정책 없음. authenticated에 books CRUD 전부 true,
--     chapters·questions SELECT true, tickets SELECT user_id = auth.uid().
--   - anon·authenticated 모두 4개 테이블에 INSERT·SELECT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER 권한 보유.
--   - 뷰·함수 없음.
--
-- 적용 후 상태
--   - anon: 4개 테이블 권한 없음.
--   - authenticated: SELECT만. tickets는 본인 행, 학습 자료는 유효 이용권 보유자만.
--   - 앞으로 public에 만드는 테이블·시퀀스·함수는 anon·authenticated·PUBLIC 권한 없이 생긴다.
--     새 테이블은 RLS 활성 + 필요한 GRANT + 정책을 마이그레이션에 함께 적어야 앱에서 읽힌다.
--
-- 적용 전 확인 결과 (2026. 09. 12.)
--   - tickets: user_id uuid, is_active boolean, started_at·expires_at timestamptz. 모두 NOT NULL.
--   - DB 세션 시간대 UTC. now() 비교와 앱의 ISO 문자열 비교가 같은 행(2건)을 고른다.
--   - 뷰·함수 없음. 앱 코드에 쓰기·Storage·RPC 없음. 학습 자료·이용권 관리는 대시보드(postgres 역할)로 한다.

begin;

-- 0. 앞으로 만드는 객체의 기본 권한 --------------------------------------------
-- Supabase 기본값은 postgres가 public에 만드는 테이블·시퀀스·함수에 anon·authenticated·service_role 권한을
-- 자동으로 준다. 함수는 PostgreSQL 기본값으로 PUBLIC에도 EXECUTE가 간다. 일반 역할 몫만 거둔다.
-- service_role은 RLS를 우회하는 서버 전용 자격이므로 그대로 둔다 (이 앱은 사용하지 않는다).
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;

-- 1. 작업 권한 정리 --------------------------------------------------------
revoke all on table public.books, public.chapters, public.questions, public.tickets from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.books, public.chapters, public.questions, public.tickets from authenticated;
grant select on table public.books, public.chapters, public.questions, public.tickets to authenticated;

-- 2. 유효 이용권 판정 함수 -------------------------------------------------
-- middleware.ts / unauthorized/page.tsx의 조건과 같다:
--   user_id = 현재 사용자, is_active = true, started_at <= now <= expires_at
-- security invoker이므로 tickets의 본인 행 정책 안에서만 읽는다. 학습 자료 정책을 참조하지 않아 재귀가 없다.
create or replace function public.has_active_ticket()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.user_id = auth.uid()
      and t.is_active = true
      and t.started_at <= now()
      and t.expires_at >= now()
  );
$$;

revoke all on function public.has_active_ticket() from public, anon;
grant execute on function public.has_active_ticket() to authenticated;

-- 3. 기존 넓은 정책 제거 -----------------------------------------------------
drop policy if exists "Update books for authenticated users" on public.books;
drop policy if exists "Select books for authenticated users" on public.books;
drop policy if exists "Insert books for authenticated users" on public.books;
drop policy if exists "Delete books for authenticated users" on public.books;
drop policy if exists "Allow read for authenticated users" on public.books;
drop policy if exists "Allow read for authenticated users" on public.chapters;
drop policy if exists "Allow read for authenticated users" on public.questions;

-- 4. 새 정책 ------------------------------------------------------------------
-- tickets: 기존 "Allow read own tickets" (user_id = auth.uid()) 를 그대로 둔다.
drop policy if exists "Select learning data with active ticket" on public.books;
create policy "Select learning data with active ticket" on public.books
  for select to authenticated
  using ((select public.has_active_ticket()));

drop policy if exists "Select learning data with active ticket" on public.chapters;
create policy "Select learning data with active ticket" on public.chapters
  for select to authenticated
  using ((select public.has_active_ticket()));

drop policy if exists "Select learning data with active ticket" on public.questions;
create policy "Select learning data with active ticket" on public.questions
  for select to authenticated
  using ((select public.has_active_ticket()));

alter table public.books     enable row level security;
alter table public.chapters  enable row level security;
alter table public.questions enable row level security;
alter table public.tickets   enable row level security;

commit;
