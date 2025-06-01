'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getBrowserInfo, openInExternalBrowser } from '@/utils/browser-detection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Smartphone, Monitor, AlertTriangle } from 'lucide-react';

export default function TestBrowserPage() {
  const [browserInfo, setBrowserInfo] = useState<any>(null);

  useEffect(() => {
    setBrowserInfo(getBrowserInfo());
  }, []);

  if (!browserInfo) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">브라우저 감지 테스트</h1>
          <p className="text-gray-600">현재 브라우저 환경을 분석합니다</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {browserInfo.isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              브라우저 정보
            </CardTitle>
            <CardDescription>
              현재 접속 중인 브라우저의 상세 정보입니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">인앱 브라우저</label>
                <div className="mt-1">
                  <Badge variant={browserInfo.isInApp ? "destructive" : "default"}>
                    {browserInfo.isInApp ? "예" : "아니오"}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">모바일 디바이스</label>
                <div className="mt-1">
                  <Badge variant={browserInfo.isMobile ? "secondary" : "outline"}>
                    {browserInfo.isMobile ? "예" : "아니오"}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">플랫폼</label>
                <div className="mt-1">
                  <Badge variant="outline">
                    {browserInfo.platform}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Android</label>
                <div className="mt-1">
                  <Badge variant={browserInfo.isAndroid ? "secondary" : "outline"}>
                    {browserInfo.isAndroid ? "예" : "아니오"}
                  </Badge>
                </div>
              </div>
              
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500">iOS</label>
                <div className="mt-1">
                  <Badge variant={browserInfo.isIOS ? "secondary" : "outline"}>
                    {browserInfo.isIOS ? "예" : "아니오"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">User Agent</label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-xs font-mono break-all">
                {browserInfo.userAgent}
              </div>
            </div>
          </CardContent>
        </Card>

        {browserInfo.isInApp && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                인앱 브라우저 감지됨
              </CardTitle>
              <CardDescription className="text-amber-700">
                Google 로그인이 제한될 수 있습니다. 외부 브라우저 사용을 권장합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => openInExternalBrowser()}
                className="w-full flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                외부 브라우저로 열기
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button 
            onClick={() => window.location.href = '/sign-in'}
            variant="outline"
          >
            로그인 페이지로 이동
          </Button>
        </div>
      </div>
    </div>
  );
} 