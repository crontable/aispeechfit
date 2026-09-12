-- 20260912000000_protect_learning_data.sql 을 적용 전 상태로 되돌린다.
-- 데이터 행은 바꾸지 않는다. 여러 번 실행해도 결과가 같다.

begin;

drop policy if exists "Select learning data with active ticket" on public.books;
drop policy if exists "Select learning data with active ticket" on public.chapters;
drop policy if exists "Select learning data with active ticket" on public.questions;
drop function if exists public.has_active_ticket();

-- 적용 전 정책 (2026. 09. 12. pg_policies 기록 그대로)
drop policy if exists "Update books for authenticated users" on public.books;
create policy "Update books for authenticated users" on public.books for update to authenticated using (true) with check (true);
drop policy if exists "Select books for authenticated users" on public.books;
create policy "Select books for authenticated users" on public.books for select to authenticated using (true);
drop policy if exists "Insert books for authenticated users" on public.books;
create policy "Insert books for authenticated users" on public.books for insert to authenticated with check (true);
drop policy if exists "Delete books for authenticated users" on public.books;
create policy "Delete books for authenticated users" on public.books for delete to authenticated using (true);
drop policy if exists "Allow read for authenticated users" on public.books;
create policy "Allow read for authenticated users" on public.books for select to authenticated using (true);
drop policy if exists "Allow read for authenticated users" on public.chapters;
create policy "Allow read for authenticated users" on public.chapters for select to authenticated using (true);
drop policy if exists "Allow read for authenticated users" on public.questions;
create policy "Allow read for authenticated users" on public.questions for select to authenticated using (true);

-- 적용 전 권한
grant all on table public.books, public.chapters, public.questions, public.tickets to anon, authenticated;

-- 적용 전 기본 권한 (Supabase 초기값)
alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, public;

commit;
