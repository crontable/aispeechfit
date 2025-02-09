'use client';

import { createClient } from '@/utils/supabase/client';

export default function LogoutButton() {
  const supabase = createClient();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    console.log('signOut', error);
  }

  return <button onClick={signOut}>로그아웃</button>;
}
