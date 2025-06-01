'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, Smartphone } from 'lucide-react';
import { isInAppBrowser, isAndroid, isIOS, openInExternalBrowser } from '@/utils/browser-detection';

interface InAppBrowserWarningProps {
  onClose?: () => void;
}

export default function InAppBrowserWarning({ onClose }: InAppBrowserWarningProps) {
  const [isInApp, setIsInApp] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    setIsInApp(isInAppBrowser());
    if (isAndroid()) {
      setPlatform('android');
    } else if (isIOS()) {
      setPlatform('ios');
    } else {
      setPlatform('other');
    }
  }, []);

  const handleOpenExternalBrowser = () => {
    openInExternalBrowser();
  };

  const getBrowserName = () => {
    switch (platform) {
      case 'android':
        return 'Chrome';
      case 'ios':
        return 'Safari';
      default:
        return '외부 브라우저';
    }
  };

  const getInstructions = () => {
    switch (platform) {
      case 'android':
        return '아래 버튼을 눌러 Chrome에서 열어주세요.';
      case 'ios':
        return '아래 버튼을 눌러 Safari에서 열어주세요.';
      default:
        return '아래 버튼을 눌러 외부 브라우저에서 열어주세요.';
    }
  };

  if (!isInApp) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              로그인 제한 안내
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Smartphone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                현재 카카오톡, 네이버 등의 <strong>인앱 브라우저</strong>에서 접속하고 계십니다.
              </p>
              <p className="mb-2">
                Google의 보안 정책에 따라 인앱 브라우저에서는 Google 로그인이 제한됩니다.
              </p>
              <p className="text-amber-600 font-medium">
                {getInstructions()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-3 pt-4">
          <Button 
            onClick={handleOpenExternalBrowser}
            className="w-full flex items-center justify-center space-x-2"
            size="lg"
          >
            <ExternalLink className="h-4 w-4" />
            <span>{getBrowserName()}으로 열기</span>
          </Button>
          
          {onClose && (
            <Button 
              onClick={onClose}
              variant="outline"
              className="w-full"
              size="sm"
            >
              닫기
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center pt-2">
          <p>외부 브라우저에서 정상적으로 Google 로그인을 이용하실 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
} 