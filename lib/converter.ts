import { BookDTO, ChapterDTO, Book, Chapter } from '@/domain/types';

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
