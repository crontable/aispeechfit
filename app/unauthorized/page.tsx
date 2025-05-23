import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { SUBSCRIPTION_REQUEST_FORM_URL } from "@/constant";

export default async function UnauthorizedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const SUBSCRIPTION_REQUEST_URL_EMAIL_FILLED = `${SUBSCRIPTION_REQUEST_FORM_URL}${user?.email}`;
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-50">
      <div className="fixed inset-0 bg-white/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">이용권이 필요합니다</h1>
        <p className="mb-2">
          서비스를 이용하기 위해서는 이용권을 신청해야 합니다.
        </p>
        <p className="mb-2">
          <strong>아래의 링크에서 이용권을 신청해주세요.</strong>
        </p>
        {user && (
          <p className="mb-6 text-sm text-gray-600">
            현재 로그인 계정: {user.email}
          </p>
        )}
        <div className="flex justify-center">
          <Button asChild>
            <a href={SUBSCRIPTION_REQUEST_URL_EMAIL_FILLED} target="_blank" rel="noopener noreferrer">
              이용권 신청하기
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
} 