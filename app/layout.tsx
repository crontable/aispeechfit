import DeployButton from '@/components/deploy-button';
import { EnvVarWarning } from '@/components/env-var-warning';
import HeaderAuth from '@/components/header-auth';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { hasEnvVars } from '@/utils/supabase/check-env-vars';
import { Geist } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import Link from 'next/link';
import './globals.css';
import { SidebarProvider } from '@/components/sidebar/sidebar-provider';
import { Sidebar } from '@/components/sidebar/sidebar';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Book, BookDTO, ChapterDTO } from '@/domain/types';
import { createClient } from '@/utils/supabase/server';

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
  ///////////
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

  const generateBooks = ({ bookDTOs, chapterDTOs }: { bookDTOs: BookDTO[]; chapterDTOs: ChapterDTO[] }): Book[] => {
    return bookDTOs.map(({ id, title, pub_year, created_at, updated_at }) => {
      const chapters =
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
  };

  const books = generateBooks({ bookDTOs, chapterDTOs });
  console.log(books, 'books');

  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SidebarProvider>
            <div className="flex h-screen">
              <Sidebar />
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
      </body>
    </html>
  );
}
