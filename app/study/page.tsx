import { ConditionalSidebarToggle } from '@/components/conditional-sidebar-toggle';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function StudyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex justify-between items-center h-[40px]">
        <div className="flex items-center gap-2">
          <ConditionalSidebarToggle />
          <h1 className='text-xl'>구술 공부</h1>
        </div>
      </div>
      <div className="w-full mt-4 flex justify-center items-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">구술 연습을 시작해보세요</h2>
          <p className="text-muted-foreground">
            왼쪽 사이드바에서 공부할 주제를 선택하고 학습을 시작하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
