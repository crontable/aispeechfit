export const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const SUBSCRIPTION_REQUEST_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdGNr9QoFaArnf_myxcBXOXNmAqdfKx9a2q-_6dgZZlsLFPqg/viewform?usp=pp_url&entry.1823718061=';

// 반응형 브레이크포인트 상수
export const BREAKPOINTS = {
  // 모바일과 태블릿/데스크탑을 구분하는 기준점 (768px은 Tailwind CSS의 md 브레이크포인트와 일치)
  MOBILE_MAX: 768,
  // 추가적인 브레이크포인트들 (필요 시 사용)
  TABLET_MIN: 768,
  TABLET_MAX: 1024,
  DESKTOP_MIN: 1024,
} as const;

// 사이드바 관련 상수
export const SIDEBAR = {
  // 데스크탑에서의 사이드바 너비 (Tailwind의 w-64 = 16rem = 256px)
  DESKTOP_WIDTH: 256,
  // 모바일에서의 사이드바 너비 (전체 화면)
  MOBILE_WIDTH: '100%',
  // Tailwind CSS 클래스명
  CLASSES: {
    DESKTOP_WIDTH: 'w-64',
    DESKTOP_CALC_WIDTH: 'w-[calc(100%-16rem)]',
  },
} as const;

// 브레이크포인트 유틸리티 함수들
export const breakpointUtils = {
  // 현재 화면이 모바일인지 확인
  isMobile: () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < BREAKPOINTS.MOBILE_MAX;
  },
  
  // 현재 화면이 태블릿인지 확인
  isTablet: () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= BREAKPOINTS.TABLET_MIN && window.innerWidth < BREAKPOINTS.TABLET_MAX;
  },
  
  // 현재 화면이 데스크탑인지 확인
  isDesktop: () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= BREAKPOINTS.DESKTOP_MIN;
  },
} as const;
