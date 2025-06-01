/**
 * 인앱 브라우저 감지 및 외부 브라우저 리다이렉트 유틸리티
 */

/**
 * 현재 브라우저가 인앱 브라우저인지 확인
 */
export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  
  // 주요 인앱 브라우저들 감지
  const inAppBrowsers = [
    'kakaotalk',      // 카카오톡
    'line',           // 라인
    'instagram',      // 인스타그램
    'fbav',           // Facebook App (Android)
    'fbios',          // Facebook App (iOS)
    'fban',           // Facebook App
    'naver',          // 네이버 앱
    'whale',          // 네이버 웨일 (일부 인앱 상황)
    'twitterandroid', // 트위터 Android
    'twitter',        // 트위터
    'linkedin',       // 링크드인
    'snapchat',       // 스냅챗
    'tiktok',         // 틱톡
    'pinterest',      // 핀터레스트
    'reddit',         // 레딧
    'discord',        // 디스코드
    'telegram',       // 텔레그램
    'wv',             // Android WebView 일반
    'version/',       // iOS WebView 감지 (Safari가 아닌 경우)
  ];
  
  // 인앱 브라우저 패턴 확인
  const isInApp = inAppBrowsers.some(browser => ua.includes(browser));
  
  // iOS WebView 추가 감지 (Safari가 아닌 경우)
  const isIOSWebView = isIOS() && !ua.includes('safari') && ua.includes('version/');
  
  
  return isInApp || isIOSWebView;
}

/**
 * 모바일 디바이스인지 확인
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

/**
 * Android 디바이스인지 확인
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /android/i.test(navigator.userAgent);
}

/**
 * iOS 디바이스인지 확인
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * 현재 URL을 외부 브라우저로 열기
 */
export function openInExternalBrowser(url?: string): void {
  const targetUrl = url || window.location.href;
  
  if (isAndroid()) {
    // Android: Chrome Intent 사용
    const intentUrl = `intent://${targetUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
    
    try {
      window.location.href = intentUrl;
      
      // Chrome이 설치되지 않은 경우를 위한 fallback
      setTimeout(() => {
        const fallbackUrl = `googlechrome://${targetUrl.replace(/^https?:\/\//, '')}`;
        window.location.href = fallbackUrl;
      }, 1500);
      
      // 모든 방법이 실패한 경우를 위한 최종 fallback
      setTimeout(() => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }, 3000);
    } catch (error) {
      console.warn('Intent URL 실행 실패, fallback 사용:', error);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  } else if (isIOS()) {
    // iOS: Safari로 열기 시도
    try {
      // iOS 9+ 에서 사용 가능한 방법
      const safariUrl = `x-web-search://?${encodeURIComponent(targetUrl)}`;
      window.location.href = safariUrl;
      
      // Safari가 실패한 경우 Chrome 시도
      setTimeout(() => {
        const chromeUrl = `googlechrome://${targetUrl.replace(/^https?:\/\//, '')}`;
        window.location.href = chromeUrl;
      }, 1500);
      
      // 최종 fallback
      setTimeout(() => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }, 3000);
    } catch (error) {
      console.warn('iOS 외부 브라우저 열기 실패, fallback 사용:', error);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  } else {
    // 데스크톱 또는 기타 플랫폼
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * 인앱 브라우저에서 외부 브라우저로 리다이렉트하는 메시지와 함께 버튼 생성
 */
export function createExternalBrowserButton(url?: string): string {
  const targetUrl = url || window.location.href;
  
  if (isAndroid()) {
    return `<a href="intent://${targetUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end;" 
             style="display: inline-block; padding: 12px 24px; background-color: #4285f4; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
             Chrome으로 열기
           </a>`;
  } else if (isIOS()) {
    return `<a href="x-web-search://?${encodeURIComponent(targetUrl)}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007AFF; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
             Safari로 열기
           </a>`;
  } else {
    return `<a href="${targetUrl}" target="_blank" rel="noopener noreferrer"
             style="display: inline-block; padding: 12px 24px; background-color: #666; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
             외부 브라우저로 열기
           </a>`;
  }
}

/**
 * 현재 브라우저 환경에 대한 상세 정보 반환
 */
export function getBrowserInfo() {
  if (typeof window === 'undefined') {
    return {
      isInApp: false,
      isMobile: false,
      platform: 'server',
      userAgent: '',
    };
  }

  return {
    isInApp: isInAppBrowser(),
    isMobile: isMobile(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    platform: isAndroid() ? 'android' : isIOS() ? 'ios' : 'desktop',
    userAgent: navigator.userAgent,
  };
} 