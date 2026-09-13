import { ThemeProvider } from "next-themes";
import { SidebarProvider } from '@/components/sidebar/sidebar-provider';
import { Sidebar, SidebarItem } from '@/components/sidebar/sidebar';
import { Book } from '@/domain/types';
import { BooksProvider } from '@/components/providers/books-provider';
import { convertBooks } from '@/lib/converter';
import { requireStudyAccess } from '@/lib/auth/access';
import { MainContent } from '@/components/main-content';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { session, client: supabase } = await requireStudyAccess();
  const user = { name: session.user.name, email: session.user.email, image: session.user.image };

  // Books 테이블 raw data 조회
  const { data: bookDTOs, error: fetchingBookError } = await supabase
    .from('books')
    .select('*')
    .order('id', { ascending: false });

  // Chapters 테이블 raw data 조회
  const { data: chapterDTOs, error: fetchingChapterError } = await supabase
    .from('chapters')
    .select('*')
    .order('sort_order', { ascending: true });

  if (fetchingBookError || fetchingChapterError) {
    return <div>학습 자료를 불러오는 중 문제가 생겼습니다.</div>;
  }

  const books = convertBooks({
    bookDTOs: bookDTOs ?? [],
    chapterDTOs: chapterDTOs ?? [],
  });

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
