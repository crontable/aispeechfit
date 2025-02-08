// /app/sidebar/page.tsx (예시)

import { BookDTO, ChapterDTO } from '@/domain/types';
import { createClient } from '@/utils/supabase/server';

// 1) 우리가 원하는 최종 JSON 구조를 위한 타입 정의

/* SQL

  SELECT
      b.id AS book_id,
      b.title AS book_title,
      b.pub_year,
      b.created_at AS book_created_at,
      b.updated_at AS book_updated_at,
      c.id AS chapter_id,
      c.chapter_title,
      c.sort_order,
      c.created_at AS chapter_created_at,
      c.updated_at AS chapter_updated_at
  FROM books b
  LEFT JOIN chapters c ON b.id = c.book_id
  ORDER BY b.id, c.sort_order;
 */

// 2) 실제 페이지 컴포넌트
export default async function Sidebar() {
  // const supabase = await createClient();

  // // 2-1) Books 테이블 raw data 조회
  // const { data: booksRaw, error: booksError } = await supabase
  //   .from('books')
  //   .select('*')
  //   .order('id', { ascending: true });

  // // 2-2) Chapters 테이블 raw data 조회
  // const { data: chaptersRaw, error: chaptersError } = await supabase
  //   .from('chapters')
  //   .select('*')
  //   .order('sort_order', { ascending: true });

  // // 에러 확인
  // if (booksError) {
  //   console.error('Error fetching books:', booksError);
  // }
  // if (chaptersError) {
  //   console.error('Error fetching chapters:', chaptersError);
  // }

  // // 2-3) booksRaw, chaptersRaw가 정상 조회되었다고 가정하고, 이제 JSON 구조로 변환
  // const bookList: BookDTO[] = [];

  // // (A) 먼저 booksRaw(각 Book의 Row) 반복
  // booksRaw?.forEach((bookRow) => {
  //   const { id, title, pub_year, created_at, updated_at } = bookRow;

  //   // (B) bookRow의 id(book_id)에 해당하는 chapterRow를 chaptersRaw에서 필터링
  //   const relatedChapters =
  //     chaptersRaw
  //       ?.filter((ch) => ch.book_id === id)
  //       .map((ch) => {
  //         return {
  //           chapterId: ch.id,
  //           chapterTitle: ch.chapter_title,
  //           sortOrder: ch.sort_order,
  //           createdAt: ch.created_at,
  //           updatedAt: ch.updated_at,
  //         } as ChapterDTO;
  //       }) || [];

  //   // (C) 최종 BookDTO 구조에 맞춰 삽입
  //   const bookDTO: BookDTO = {
  //     bookId: id,
  //     bookTitle: title,
  //     pubYear: pub_year,
  //     createdAt: created_at,
  //     updatedAt: updated_at,
  //     chapters: relatedChapters,
  //   };

  //   bookList.push(bookDTO);
  // });

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
      test
      {/* <ul>
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
      </ul> */}
    </div>
  );
}
