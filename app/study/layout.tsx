import { ThemeProvider } from "next-themes";
import { SidebarProvider } from '@/components/sidebar/sidebar-provider';
import { Sidebar, SidebarItem } from '@/components/sidebar/sidebar';
import { Book } from '@/domain/types';
import { BooksProvider } from '@/components/providers/books-provider';
import { convertBooks } from '@/lib/converter';
import { readServiceBooks, ServiceError } from '@/lib/service/client';
import { redirect } from 'next/navigation';
import { requireStudyAccess } from '@/lib/auth/access';
import { MainContent } from '@/components/main-content';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const access = await requireStudyAccess();
  const user = access.user;
  let result;
  try { result = await readServiceBooks(); }
  catch (error) {
    if (error instanceof ServiceError && error.status === 401) redirect('/sign-in');
    if (error instanceof ServiceError && error.status === 403) redirect('/auth/complete');
    redirect('/service-unavailable');
  }
  const { books: bookDTOs, chapters: chapterDTOs } = result;

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
