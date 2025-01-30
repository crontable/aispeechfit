// /app/sidebar/page.tsx (예시)

import { createClient } from '@/utils/supabase/server';

// 1) 우리가 원하는 최종 JSON 구조를 위한 타입 정의
export interface ChapterDTO {
  chapterId: number;
  chapterTitle: string;
  sortOrder: number;
  createdAt: string; // ISO 날짜 문자열이 반환될 수 있으므로 string
  updatedAt: string;
}

export interface BookDTO {
  bookId: number;
  bookTitle: string;
  pubYear: number;
  createdAt: string;
  updatedAt: string;
  chapters: ChapterDTO[]; // Book 내에 여러 챕터를 중첩
}

// 2) 실제 페이지 컴포넌트
export default async function Sidebar() {
  const supabase = await createClient();

  // 2-1) Books 테이블 raw data 조회
  const { data: booksRaw, error: booksError } = await supabase
    .from('books')
    .select('*')
    .order('id', { ascending: true });

  // 2-2) Chapters 테이블 raw data 조회
  const { data: chaptersRaw, error: chaptersError } = await supabase
    .from('chapters')
    .select('*')
    .order('sort_order', { ascending: true });

  // 에러 확인
  if (booksError) {
    console.error('Error fetching books:', booksError);
  }
  if (chaptersError) {
    console.error('Error fetching chapters:', chaptersError);
  }

  // 2-3) booksRaw, chaptersRaw가 정상 조회되었다고 가정하고, 이제 JSON 구조로 변환
  const bookList: BookDTO[] = [];

  // (A) 먼저 booksRaw(각 Book의 Row) 반복
  booksRaw?.forEach((bookRow) => {
    const { id, title, pub_year, created_at, updated_at } = bookRow;

    // (B) bookRow의 id(book_id)에 해당하는 chapterRow를 chaptersRaw에서 필터링
    const relatedChapters =
      chaptersRaw
        ?.filter((ch) => ch.book_id === id)
        .map((ch) => {
          return {
            chapterId: ch.id,
            chapterTitle: ch.chapter_title,
            sortOrder: ch.sort_order,
            createdAt: ch.created_at,
            updatedAt: ch.updated_at,
          } as ChapterDTO;
        }) || [];

    // (C) 최종 BookDTO 구조에 맞춰 삽입
    const bookDTO: BookDTO = {
      bookId: id,
      bookTitle: title,
      pubYear: pub_year,
      createdAt: created_at,
      updatedAt: updated_at,
      chapters: relatedChapters,
    };

    bookList.push(bookDTO);
  });

  // 3) 이제 bookList가 우리가 원하는 계층형 JSON 구조가 됨
  // bookList: BookDTO[] = [
  //   {
  //     bookId: 1,
  //     bookTitle: "2025년 구술시험 대비",
  //     ...
  //     chapters: [
  //       { chapterId: 1, chapterTitle: '보디빌딩협회...', ... },
  //       ...
  //     ]
  //   },
  //   ...
  // ]

  // 4) 여기서부터는 사이드바 UI로 렌더링
  //    예시로, Book -> Chapter를 중첩 리스트 형태로 표현
  return (
    <div>
      <h2>사이드바</h2>
      <ul>
        {bookList.map((book) => (
          <li key={book.bookId}>
            <strong>{book.bookTitle}</strong>
            <ul>
              {book.chapters.map((ch) => (
                <li key={ch.chapterId}>{ch.chapterTitle}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
