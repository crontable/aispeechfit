import { Geist } from 'next/font/google';
import './globals.css';
import { DEFAULT_BASE_URL } from '@/constant';

export const metadata = {
  metadataBase: new URL(DEFAULT_BASE_URL),
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
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
