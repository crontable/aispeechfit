import ReversibleCard from '@/components/ReversibleCard';
import { ConditionalSidebarToggle } from '@/components/conditional-sidebar-toggle';
import { convertToReversibleCardQuestions } from '@/lib/converter';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

interface Props {
  params: {
    bookId: string;
    chapterId: string;
  };
}

export default async function ChapterPage({ params }: Props) {
  const { bookId, chapterId } = params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  // 해당 챕터 정보 조회
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .single();

  if (chapterError) {
    console.error('Error fetching chapter:', chapterError);
    return <div>챕터 정보를 불러오는 중 오류가 발생했습니다.</div>;
  }

  // 해당 챕터에 속한 질문들 조회
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (questionsError) {
    console.error('Error fetching questions:', questionsError);
    return <div>질문 데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex-1 w-full flex flex-col">
        <div className="flex justify-between items-center h-[40px]">
          <div className="flex items-center gap-2">
            <ConditionalSidebarToggle />
            <h1 className='text-xl'>{chapter?.title || '챕터'}</h1>
          </div>
        </div>
        <div className="w-full mt-4 flex justify-center items-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">이 챕터에는 아직 질문이 없습니다.</h2>
          </div>
        </div>
      </div>
    );
  }

  // ReversibleCard 컴포넌트에 맞는 형식으로 변환
  const convertedQuestions = convertToReversibleCardQuestions(questions);

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex justify-between items-center h-[40px]">
        <div className="flex items-center gap-2">
          <ConditionalSidebarToggle />
          <h1 className='text-xl'>{chapter?.title || '챕터'}</h1>
        </div>
      </div>
      <div className="w-full mt-4">
        <ReversibleCard questions={convertedQuestions} />
      </div>
    </div>
  );
} 