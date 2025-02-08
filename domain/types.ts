export interface BookDTO {
  id: number;
  title: string;
  pub_year: number;
  created_at: Date;
  updated_at: Date;
}

export interface ChapterDTO {
  id: number;
  book_id: number;
  title: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface QuestionDTO {
  id: number;
  chapter_id: number;
  question: string;
  answer: string;
  score: number;
  created_at: Date;
  updated_at: Date;
}

export interface CommonRecord {
  id: number;
  createdAt: Date;
  updatedAt: Date;
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
