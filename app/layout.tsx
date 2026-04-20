import './globals.css';
import { DEFAULT_BASE_URL } from '@/constant';
import { Toaster } from 'sonner';

export const metadata = {
  metadataBase: new URL(DEFAULT_BASE_URL),
  title: 'AI 스피치핏',
  description: '생활스포츠지도사 2급 구술 시험 준비 암기 앱',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
