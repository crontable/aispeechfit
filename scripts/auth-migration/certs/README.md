# Supabase 공개 CA 인증서

`prod-ca-2021.crt`는 Supabase 공식 대시보드의 배포 URL에서 2026-09-13에 받은 공개 CA 인증서다. 개인키나 프로젝트 비밀값을 포함하지 않는다. 원본 조사 도구에서 CA 및 호스트 이름 검증을 유지하기 위해 사용한다.

- 공식 설정 출처: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json (`ssl:certificate_url`)
- 다운로드: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- 공식 문서: https://supabase.com/docs/guides/platform/ssl-enforcement

인증서 교체 시 공식 배포 경로를 다시 확인한다. 원격 서버가 제시하는 인증서를 검증 없이 신뢰하거나 `rejectUnauthorized`를 해제하지 않는다.
