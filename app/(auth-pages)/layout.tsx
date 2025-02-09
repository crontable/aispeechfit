import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-50">
      <div className="fixed inset-0 bg-white/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md px-4 py-8">
        <Card className="w-full shadow-lg p-8">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/icon.jpg" alt="Logo" className="h-32 w-32 rounded-full" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">AI 스피치 구술 로그인</h1>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
