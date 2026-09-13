import { readServiceChapter, ServiceError } from '@/lib/service/client';
import { notFound, redirect } from 'next/navigation';
import ReversibleCard from "@/components/ReversibleCard";
import { ConditionalSidebarToggle } from "@/components/conditional-sidebar-toggle";
import { convertToReversibleCardQuestions } from "@/lib/converter";
import { requireStudyAccess } from "@/lib/auth/access";

// 페이지 매개변수의 타입 정의
type PageParams = Promise<{
  bookId: string;
  chapterId: string;
}>;

export default async function ChapterPage({ params }: { params: PageParams }) {
  const { bookId, chapterId } = await params;
  await requireStudyAccess();
  let result;
  try { result = await readServiceChapter(bookId, chapterId); }
  catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    if (error instanceof ServiceError && error.status === 401) redirect('/sign-in');
    if (error instanceof ServiceError && error.status === 403) redirect('/unauthorized');
    redirect('/service-unavailable');
  }
  const { chapter, questions } = result;

  if (!questions || questions.length === 0) {
    return (
      <div className="flex-1 w-full flex flex-col">
        <div className="flex justify-between items-center h-[40px]">
          <div className="flex items-center gap-2">
            <ConditionalSidebarToggle />
            <h1 className="text-xl">{chapter?.title || "챕터"}</h1>
          </div>
        </div>
        <div className="w-full mt-4 flex justify-center items-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">
              이 챕터에는 아직 질문이 없습니다.
            </h2>
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
          <h1 className="text-xl">{chapter?.title || "챕터"}</h1>
        </div>
      </div>
      <div className="w-full mt-4">
        <ReversibleCard questions={convertedQuestions} />
      </div>
    </div>
  );
}
