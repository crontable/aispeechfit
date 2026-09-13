import { Button } from '@/components/ui/button';
export default function ServiceUnavailable() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 text-center">
    <h1 className="text-2xl font-bold">서비스에 연결하지 못했습니다</h1>
    <p>로그인이나 이용권 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
    <Button asChild><a href="/study">다시 확인</a></Button>
    <a href="/sign-in" className="underline">로그인 화면으로 이동</a>
  </main>;
}
