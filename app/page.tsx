import Hero from '@/components/hero';
import LogoutButton from '@/components/LogoutButton';
import ConnectSupabaseSteps from '@/components/tutorial/connect-supabase-steps';
import SignUpUserSteps from '@/components/tutorial/sign-up-user-steps';
import { hasEnvVars } from '@/utils/supabase/check-env-vars';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createClient();

  console.log(await supabase.auth.getUser());
  console.log(await supabase.auth.getSession());

  return (
    <>
      안녕하세요
      <LogoutButton />
      <Hero />
      <main className="flex-1 flex flex-col gap-6 px-4">
        <h2 className="font-medium text-xl mb-4">Next steps</h2>
        {hasEnvVars ? <SignUpUserSteps /> : <ConnectSupabaseSteps />}
      </main>
    </>
  );
}
