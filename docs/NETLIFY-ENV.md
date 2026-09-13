# 공개 설정과 로컬 비밀정보

| 파일 | 내용 | 취급 |
| --- | --- | --- |
| `.env` | 공개 가능한 설정 6개 | 복사·가져오기에 비밀정보가 포함되지 않도록 유지 |
| `.env.local` | 모든 비밀정보와 로컬 개발용 덮어쓰기 | 호스팅에 업로드하거나 환경 변수로 복사하지 않음 |

## 공개 설정

`.env`에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `BETTER_AUTH_URL`, `BETTER_AUTH_DATA_API_READY`, `KAKAO_APP_ID`, `KAKAO_CLIENT_ID`만 둔다. Supabase 키는 공개용 키여야 하며 관리자 키를 넣지 않는다.

## 비밀정보

`AUTH_DATABASE_URL`, `AUTH_PHONE_DATABASE_URL`, `BETTER_AUTH_SECRET`, `KAKAO_CLIENT_SECRET`, `SUPABASE_DATA_SIGNING_JWK`는 `.env.local`에만 보관한다. 관리자 연결 `SUPABASE_MIGRATION_SOURCE_DATABASE_URL`과 로컬 DB 연결·비밀번호도 같은 파일에 둔다. 두 실제 파일은 Git에서 제외한다.

Next.js 개발 서버와 Node 관리 명령은 두 파일을 읽으며 `.env.local`이 우선한다. 계정 준비·DB 전환 도구가 생성하는 비밀정보 역시 `.env.local`에만 기록한다. 별도 파일 생성 스크립트는 없다.

## 운영 배포 상태

사용자 요구에 따라 비밀정보를 Netlify 환경 변수로 가져오는 절차는 제거했다. `.env`의 공개 설정만으로 현재 Better Auth 서버와 JWT 서명 기능을 운영할 수는 없다. 비밀정보를 Netlify 환경 변수에 저장하지 않는 운영 구조는 아직 구현하지 않았다. 서버 실행 위치 또는 비밀정보 공급 방식을 결정·구현하기 전에는 운영 복구 완료로 판단하지 않는다.

이번 분류 변경은 로컬 파일에 적용했다. 실제 Netlify에 기존 등록된 비밀정보가 있는지는 확인하지 않았으며, 원격 설정을 수정하지 않았다.
