// 두 인증 함수의 운영 전환 구간에 사용한다. DB·환경 변수·요청 본문에 접근하지 않는다.
export function maintenanceHandler(): Response {
  return new Response(JSON.stringify({
    code: 'SERVICE_MAINTENANCE',
    message: '서비스를 점검하고 있습니다. 잠시 후 다시 시도해 주세요.',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
