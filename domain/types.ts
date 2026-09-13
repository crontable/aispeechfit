import type { Tables } from './database.types';

// DB 행 타입. 손으로 적지 않고 생성 타입에서 가져온다. 열이 바뀌면 여기를 읽는 코드가 컴파일에서 걸린다.
export type BookDTO = Tables<'books'>;
export type ChapterDTO = Tables<'chapters'>;
export type QuestionDTO = Tables<'questions'>;

// 화면용 타입. 날짜는 JSON 응답 그대로 ISO 문자열이다.
export interface CommonRecord {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book extends CommonRecord {
  title: string;
  publishedYear: number;
  chapters?: Chapter[];
}

export interface Chapter extends CommonRecord {
  bookId: number;
  title: string;
  sortOrder: number;
  questions?: Question[];
}

export interface Question extends CommonRecord {
  chapterId: number;
  question: string;
  answer: string;
  score: number;
}
