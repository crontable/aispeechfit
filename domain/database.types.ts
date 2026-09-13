// Supabase CLI가 public 스키마에서 생성한 타입이다. 생성 파일은 Edge Function 배포 번들에 들어가야 하므로
// supabase/functions/_shared/ 아래에 두고, Next.js 쪽은 이 파일을 거쳐 읽는다. 생성 명령은 docs/DB-OPERATIONS.md에 있다.
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from '@/supabase/functions/_shared/database.types';
