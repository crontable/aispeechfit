import { BookDTO, ChapterDTO, QuestionDTO, Book, Chapter } from '@/domain/types';
import { IQuestion } from '@/components/ReversibleCard';

export function convertBooks({ bookDTOs, chapterDTOs }: { bookDTOs: BookDTO[]; chapterDTOs: ChapterDTO[] }): Book[] {
  return bookDTOs.map(({ id, title, published_year, created_at, updated_at }) => {
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
      publishedYear: published_year,
      createdAt: created_at,
      updatedAt: updated_at,
      chapters,
    };
  });
}

export function convertToReversibleCardQuestions(questions: QuestionDTO[]): IQuestion[] {
  return questions.map(question => ({
    ...question,
    // ReversibleCard는 answer를 문자열로 받는다. DB의 null은 빈 문자열로 넘긴다.
    answer: question.answer ?? '',
    score: question.score ?? undefined,
    // priority가 string이면 숫자로 변환, 없거나 빈 문자열이면 0으로 설정
    priority: question.priority ? 
      (typeof question.priority === 'number' ? question.priority : parseInt(question.priority) || 0) : 
      0,
    // questions 테이블에 keyword·mainKeyword 열이 없다. 이전에도 undefined를 빈 배열로 바꿔 넘겼다.
    keywords: [],
    mainKeywords: [],
  }));
}
