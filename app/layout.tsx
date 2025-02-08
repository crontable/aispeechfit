import { ThemeSwitcher } from '@/components/theme-switcher';
import { Geist } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { SidebarProvider } from '@/components/sidebar/sidebar-provider';
import { Sidebar, SidebarItem } from '@/components/sidebar/sidebar';
import { Book, BookDTO, ChapterDTO } from '@/domain/types';
import { createClient } from '@/utils/supabase/server';
import { convertBooks } from '@/lib/converter';
import { BooksProvider } from '@/components/providers/books-provider';

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Next.js and Supabase Starter Kit',
  description: 'The fastest way to build apps with Next.js and Supabase',
};

const geistSans = Geist({
  display: 'swap',
  subsets: ['latin'],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  // 2-1) Books 테이블 raw data 조회
  const { data: bookDTOs, error: fetchingBookError } = await supabase
    .from('books')
    .select('*')
    .order('id', { ascending: true });

  // 2-2) Chapters 테이블 raw data 조회
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
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <BooksProvider books={books}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SidebarProvider>
              <div className="flex h-screen">
                <Sidebar items={sidebarItems} />
                <main className="flex-1 overflow-auto">
                  <div className="container mx-auto py-4">
                    <div className="flex justify-between items-center mb-4">
                      {/* <SidebarToggle /> */}
                      <ThemeSwitcher />
                    </div>
                    {/* <ChatArea /> */}
                    {children}
                  </div>
                </main>
              </div>
            </SidebarProvider>
          </ThemeProvider>
        </BooksProvider>
      </body>
    </html>
  );
}
