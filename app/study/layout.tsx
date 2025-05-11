import { ThemeProvider } from "next-themes";
import { SidebarProvider } from '@/components/sidebar/sidebar-provider';
import { Sidebar, SidebarItem } from '@/components/sidebar/sidebar';
import { Book } from '@/domain/types';
import { BooksProvider } from '@/components/providers/books-provider';
import { convertBooks } from '@/lib/converter';
import { createClient } from '@/utils/supabase/server';
import { MainContent } from '@/components/main-content';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // 현재 로그인한 사용자 정보 가져오기
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('Error fetching user:', userError);
  }

  // Books 테이블 raw data 조회
  const { data: bookDTOs, error: fetchingBookError } = await supabase
    .from('books')
    .select('*')
    .order('id', { ascending: true });

  // Chapters 테이블 raw data 조회
  const { data: chapterDTOs, error: fetchingChapterError } = await supabase
    .from('chapters')
    .select('*')
    .order('sort_order', { ascending: true });

  // 에러 확인
  if (fetchingBookError) {
    console.error('Error fetching books:', fetchingBookError);
  }
  if (fetchingChapterError) {
    console.error('Error fetching chapters:', fetchingChapterError);
  }

  if (!bookDTOs || !chapterDTOs) {
    return <div>Loading...</div>;
  }

  const books = convertBooks({ bookDTOs, chapterDTOs });

  const sidebarItems: SidebarItem[] = books.map((book: Book) => ({
    id: book.id,
    title: book.title,
    children: book.chapters?.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      href: `/books/${book.id}/chapters/${chapter.id}`,
    })),
  }));

  return (
    <BooksProvider books={books}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SidebarProvider>
          <div className="flex h-screen">
            <Sidebar items={sidebarItems} userData={user} />
            <MainContent>{children}</MainContent>
          </div>
        </SidebarProvider>
      </ThemeProvider>
    </BooksProvider>
  );
}
