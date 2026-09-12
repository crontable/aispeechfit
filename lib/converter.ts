import { BookDTO, ChapterDTO, Book, Chapter } from '@/domain/types';
import { IQuestion } from '@/components/ReversibleCard';

export function convertBooks({ bookDTOs, chapterDTOs }: { bookDTOs: BookDTO[]; chapterDTOs: ChapterDTO[] }): Book[] {
  return bookDTOs.map(({ id, title, pub_year, created_at, updated_at }) => {
    const chapters: Chapter[] =
      chapterDTOs
        ?.filter((chapterDTO) => chapterDTO.book_id === id)
        .map((chapterDTO) => {
          return {
            id: chapterDTO.id,
            bookId: id,
            title: chapterDTO.title,
            sortOrder: chapterDTO.sort_order,
            createdAt: chapterDTO.created_at,
            updatedAt: chapterDTO.updated_at,
          };
        }) || [];

    return {
      id,
      title,
      publishedYear: pub_year,
      createdAt: created_at,
      updatedAt: updated_at,
      chapters,
    };
  });
}

/** questions 테이블 행. priority는 문자열로 올 수 있고 keyword·mainKeyword는 열 이름이 단수다. */
type QuestionRow = Omit<IQuestion, 'priority' | 'keywords' | 'mainKeywords'> & {
  priority?: number | string | null;
  keyword?: string[] | null;
  mainKeyword?: string[] | null;
};

export function convertToReversibleCardQuestions(questions: QuestionRow[]): IQuestion[] {
  return questions.map(question => ({
    ...question,
    // priority가 string이면 숫자로 변환, 없거나 빈 문자열이면 0으로 설정
    priority: question.priority ? 
      (typeof question.priority === 'number' ? question.priority : parseInt(question.priority) || 0) : 
      0,
    // keywords를 mainKeywords로 변환 (필요한 경우)
    keywords: question.keyword || [],
    mainKeywords: question.mainKeyword || [],
    // 다른 필드들은 기존 형태 유지
  }));
}
