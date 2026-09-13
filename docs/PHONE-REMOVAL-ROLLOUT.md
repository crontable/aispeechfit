# 전화번호 제거의 운영 적용 준비

이슈 [#32](https://github.com/crontable/aispeechfit/issues/32)의 9번 계획이다. 6~8번 구현은 기능별로 커밋했고, 이 문서는 운영 대상·점검·보존·복원·폐기 방법을 준비한다. 아래 외부 변경은 아직 실행하지 않았다. 실제 원본 앱의 계정 연결, 백업과 복원 확인이 남아 있어 9번의 실행 준비 완료 표시는 보류한다.

## 1. 코드와 적용 대상

| 대상 | 2026-09-13 23시대 KST에 확인한 값 | 적용할 때의 기준 |
| --- | --- | --- |
| 작업 브랜치 | `feat/32-remove-phone-collection` | 기능 구현 기준 SHA는 `529e1bb`다. 적용 직전 전체 SHA와 변경 유무를 다시 기록한다. |
| 기능별 커밋 | `95b5b31` 화면 이동, `ea7b374` 개발·관리 도구와 전용 접근 권한 정리, `529e1bb` 빌드·HTTP 검사 | 영어 conventional commit 제목과 한국어 본문을 사용했다. 세 커밋을 합친 파일 내용은 이전에 검증한 작업 폴더와 같다. |
| 선행 PR | [#31](https://github.com/crontable/aispeechfit/pull/31), OPEN, `feat/27-db-generated-types`, `0295438` | 현재 검토 기준은 `0295438`이며 해당 SHA가 작업 브랜치의 조상임을 확인했다. #31 병합 뒤에는 실제 main과 diff를 다시 확인한다. |
| 이번 브랜치의 원격 PR | 없음 | PR 번호·새 미리보기 deploy ID는 아직 없다. 이슈 번호 32를 미리보기 번호로 사용하지 않는다. |
| Netlify | 사이트 `aispeechfit`, ID `dabab915-aaa1-4163-afcd-e598d29f7d2a` | GitHub 저장소 `crontable/aispeechfit`, production branch `main`, 명령 `pnpm build`, 출력 `.next`다. |
| 현재 운영 배포 | `6aa63d4f9ab44b0008557487`, SHA `3200f2eafb3fac379c88371536afda1f768c996a`, ready, 공개 잠금 false | 운영 주소는 `https://aispeechfit.crontables.com`이다. 옛 DB·Edge와 맞는 복원 조합의 웹 배포다. |
| 기존 미리보기 | PR #30의 `6aa63c88a321d00008b42999`, ready | Origin은 `https://deploy-preview-30--aispeechfit.netlify.app`이다. PR #31 배포 `6aa64bfdbdfc8c0008b17fff`는 error이며 새 변경의 검증 결과로 쓰지 않는다. |
| Supabase | 프로젝트 `bovbypbhuuhasrkwpfld`, 서울 리전, DB `postgres`, PostgreSQL 15.8 | URL은 `https://bovbypbhuuhasrkwpfld.supabase.co`다. 운영과 기존 미리보기 함수가 같은 프로젝트의 DB·Secrets를 사용한다. |
| 운영 Edge | `service-auth-v1`, 플랫폼 버전 3, ACTIVE | 함수 URL은 위 프로젝트 URL의 `/functions/v1/service-auth-v1`이다. 새 코드와 DB 열을 함께 맞춘다. |
| 미리보기 Edge | `service-auth-preview-v1`, 플랫폼 버전 1, ACTIVE | `/functions/v1/service-auth-preview-v1`이며, 실제 배포 본문과 로컬 진입점 모두 PR #30 Origin이다. |

활성 함수는 위 두 개다. 두 배포 본문에서 `AUTH_PHONE_DATABASE_URL`·`KAKAO_APP_ID` 참조와 기존 계정 매핑을 확인했다. 새 운영 코드만 올리고 미리보기 함수를 남기면 구버전이 계속 같은 DB에 접근할 수 있다. 열 이름 전환·전화번호 권한 회수·Secret 삭제의 대상에 두 함수를 모두 포함한다.

## 2. 읽기 전용 조사와 보존 기준

관리 연결의 호스트·포트·DB·프로젝트를 공개 프로젝트 URL과 대조하고 TLS 인증서 검증을 유지했다. `REPEATABLE READ READ ONLY`, 실제 `statement_timeout=15s`를 확인한 뒤 집계·정의만 읽고 `ROLLBACK`과 연결 종료로 끝냈다. 개인정보 원문·비밀번호·쿠키·토큰은 출력하지 않았다. 열·제약·정책·함수·트리거·권한 정의는 2번 조사와 같았다.

재확인은 `supabase/verification/phone-removal-preflight.sql`을 같은 대상의 읽기 전용 연결에서 실행한다. SQL은 현재 DB 이름과 읽기 전용·시간 제한을 검사한다. 프로젝트 호스트와 TLS 검증은 클라이언트에서 먼저 고정해야 한다. 이 파일 전체를 2026-09-13 23:20 KST에 실행해 17개 SQL 문장이 성공하고 마지막 `ROLLBACK`으로 끝나는 것을 확인했다. 실제 DB는 PostgreSQL 15.8, 읽기 전용 on, 시간 제한 15초였으며 아래 건수와 계정 연결 불일치 0건이 재확인됐다. 이 파일의 성공을 백업 또는 운영 적용 성공으로 해석하지 않는다.

| 보존 대상 | 이번 실측 | 적용 전후 비교 방법 |
| --- | --- | --- |
| `better_auth.users`, `accounts` | 각각 1행 | 기존 `users.id`, `accounts.id/user_id/provider_id`와 제공자 식별값을 고정한다. `accounts.account_id(text)`의 이름만 `provider_account_id`로 바꾼다. |
| `public.tickets` | 1행, 유효 1행 | ID·소유자·시작·만료·활성 상태·기존 생성/수정 시각을 동일한 행 집합으로 대조한다. 이용권을 다른 사용자에게 옮기거나 기간을 늘리지 않는다. |
| 학습 자료 | books 2행, chapters 17행, questions 662행 | 전체 행과 교재·챕터 관계를 대조한다. |
| `auth_source.tickets` | 31행, 유효 2행 | 보관 자료를 그대로 유지하고 서비스 이용권으로 다시 이전하지 않는다. |
| `better_auth.sessions` | 4행, 모두 만료 | 과거 4행은 이 작업의 삭제 대상이 아니다. 정상 로그인으로 추가되는 세션은 기존 행과 구분한다. |
| `kakao_identities`의 계정 출처 | 1행, 계정 결합 불일치 0건 | `user_id/account_id/provider_id/app_id/subject` 다섯 열과 기존 FK·유일성을 보존한다. 전화번호 관련 값과 분리해서 다룬다. |

조회 시 runtime/writer 역할의 연결과 멤버십은 0건이었다. writer 역할의 공유 의존성은 현재 DB `postgres`에만 있었고, 역할 표식은 `aispeechfit issue 20 runtime`이었다. 적용 직전 같은 검사를 반복하며 새 연결·정의 차이를 자동 종료 또는 포괄적 권한 변경으로 우회하지 않는다.

## 3. 미리보기와 전환 방식

Netlify의 `deploy-preview` 설정은 `BETTER_AUTH_URL`과 `NEXT_PUBLIC_SITE_URL`을 PR #30 주소에, `AUTH_FUNCTION_URL`을 같은 운영 프로젝트의 preview 함수에 연결한다. `NEXT_PUBLIC_SUPABASE_URL`도 전 컨텍스트에서 같은 프로젝트다. `stop_builds=false`이고 PR #31에 자동 미리보기 생성 기록이 있다. production 공개 잠금은 현재 false다. 공개 잠금은 새 production 배포의 공개를 막는 기능이며, 이미 열린 사이트와 Edge 요청을 멈추는 수단은 아니다. [Netlify 배포 관리 문서](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)를 따른다.

기존 이슈에 정한 점검 시간 방식으로 계획한다. 두 Edge 진입점을 일시 중단하고 백업 → DB 두 SQL → 새 웹 연결 → 정상 Edge 두 개로 요청 재개 순서로 맞춘다. 웹 연결 시점에는 Edge의 점검 응답을 유지한다. 정상 Edge 배포가 그 함수의 서비스 재개 시점이라는 점을 적용표에 명시한다. 같은 DB의 열을 바꾸면 운영·preview 양쪽의 이전 코드가 영향을 받기 때문에 두 함수를 함께 다룬다. 실제 점검 시작 시각·운영 변경 범위는 실행 전에 확인한다.

새 PR을 만들게 되면 실제 번호를 받은 뒤 미리보기 Origin·callback·Netlify 컨텍스트와 `service-auth-preview-v1/index.ts`를 같은 주소로 고정하고 검증한다. 현재 PR #30용 함수를 다른 Origin에 자동 개방하지 않는다. 원격 게시·PR 생성은 이번 단계에서 실행하지 않았다.

## 4. 원본 카카오 앱과 계정 연결

원본 앱 `1195231`의 콘솔을 직접 읽었다. 로그인은 OFF, `account_email`·`profile_nickname`은 사용 안 함, REST API 키 `4121770`의 카카오 callback은 비어 있고 클라이언트 시크릿은 미생성이다. 현재 Supabase Secrets는 테스트 앱 `1195233`의 로컬 설정과 일치한다. 원본·테스트 앱의 같은 사람에 대한 실제 subject 일치 여부는 아직 확인하지 않았다.

1. 원본 앱의 [로그인 설정](https://developers.kakao.com/console/app/1195231/product/login), [동의항목](https://developers.kakao.com/console/app/1195231/product/login/scope), [REST API 키 설정](https://developers.kakao.com/console/app/1195231/config/platform-key/rest/4121770)을 준비 대상으로 삼는다. 동의항목은 현재 코드가 요구하는 이메일·닉네임이며 전화번호 권한·추가 본인 인증은 요청하지 않는다. 클라이언트 시크릿 생성·보관은 실제 설정 준비 시 운영자가 처리한다. 공개 키·시크릿 조합을 운영과 검증에 임의로 섞지 않는다.
2. 운영 callback은 `https://aispeechfit.crontables.com/api/auth/callback/kakao`, 검증 callback은 확정된 검증 Origin 뒤의 `/api/auth/callback/kakao`다. 원본 앱으로 동의·코드 교환을 수행할 때는 운영 계정 생성 전의 전용 확인 흐름에서 실제 사용자와 앱 출처를 확인한다. 원문 subject·토큰은 비공개 메모리에서만 비교하고 결과만 기록한다. 이 확인 흐름은 아직 실행하지 않았다.
3. subject가 같으면 기존 계정으로 로그인하되 기존 테스트 앱 provenance를 덮어쓰지 않는다. subject가 다르면 `accounts`의 `(provider_id,provider_account_id)`가 별도 계정으로 인식한다. 현재 자동 연결은 꺼져 있고 `/link-social`도 비활성이다. 기존 사용자·계정 UUID를 보존하면서 확인된 원본 계정을 연결할 구체 SQL·충돌 검사·되돌림을 먼저 검토한다. 이메일이 같다는 이유로 병합하거나 이용권을 이전하지 않는다.
4. 두 앱 출처를 동시에 저장해야 한다면 사용자당 한 행인 현재 identity 구조로는 충분하지 않다. 별도 출처 관계를 추가할지의 후보와 FK·유일성·이관 방법은 실제 subject 비교 결과에 따라 확정한다. 확인 전에는 새 구조를 구현하거나 기존 관계를 바꾸지 않는다.
5. 원본 앱의 관리자·테스터가 아닌 카카오 계정, 기존 이용권 계정, iOS·Android 카카오톡이 필요하다. 운영자가 검증 가능한 계정·기기를 정한다. 기존 계정은 ID·이용권 보존을, 일반 계정은 번호 없는 가입과 이용권 없음 안내를, 두 기기는 공유 링크 → 로그인 → 복귀 → 새로고침을 확인한다.

## 5. 백업과 복원 준비

Supabase 백업 API는 `backups=[]`, `pitr_enabled=false`를 반환했다. 이번 조회로 사용할 수 있는 복원 지점을 확보하지 못했다. [공식 백업 문서](https://supabase.com/docs/guides/platform/backups)의 내보내기·복원 절차를 기준으로 별도 백업을 준비한다. 현재 저장한 메타데이터와 함수 본문은 행 백업을 대신하지 않는다.

1. 운영자는 Git·공유·동기화 폴더 밖의 백업 보관 위치와 보관 종료 시점을 정한다. 백업에는 인증·전화번호가 포함되므로 디렉터리는 0700, 파일은 0600으로 제한한다. 이번 단계에서는 개인정보 행 사본을 새로 만들지 않았다.
2. 실제 작업 전에 PostgreSQL 15 도구로 `--format=custom` 백업을 만들고 `pg_restore --list`를 확인한다. 비밀번호는 명령줄·로그에 넣지 않고 보호된 `PGSERVICEFILE`/`PGPASSFILE`로 전달하며 `sslmode=verify-full`과 프로젝트 CA를 사용한다. `better_auth`, `public`, `auth_source` 및 참조되는 `auth.users`를 포함하는 복원 범위와 필요한 역할·스키마 정의를 먼저 확정한다. 특정 스키마만 내보내는 경우 그 FK가 참조하는 객체를 누락하지 않는다.
3. 별도 로컬 PostgreSQL 15.8에 백업을 복원해 대상 행·UUID·FK·기간·정책을 원본 집계와 비교한다. 원본 자료가 들어간 복원 환경은 일반 테스트 fixture로 사용하지 않으며 비공개로 보관하고 정해 둔 기한에 폐기한다. 복원 성공과 책임자·시각·백업 파일 해시·보관 위치가 없으면 운영 SQL을 시작하지 않는다.
4. 운영 Netlify의 기존 deploy ID와 두 Edge의 기존 소스·설정·배포 본문 해시를 보관한다. 현재 받은 Edge 본문은 ESZIP 형식이며 버전 3·1과 대조했다. 이 본문 파일을 일반 소스 multipart 업로드에 그대로 넣지 않는다. Git `3200f2e`의 대응 소스로 배포 입력을 구성하고 플랫폼 `bundleOnly=1` 검증 및 반환 본문과의 소스 일치 확인을 마쳐 복원용 묶음을 준비한다. 플랫폼 번들 검증·복원 연습은 아직 미실행이다.

## 6. 점검 시간 방식의 적용·재개·복원 절차

아래는 기존 이슈에 정한 점검 시간 방식의 실행 초안이다. 적용자·시작 시각·종료 예상·실제 배포 ID·백업 보관 위치를 채운 뒤 외부 실행 범위를 확인한다. SQL의 현재 파일 해시는 9절의 명령으로 대조한다.

| 순서 | 실행 방법 | 다음 순서로 넘어갈 조건 |
| --- | --- | --- |
| 1 | 현재 production 배포를 잠그고 실제 설정을 다시 조회한다. 별도 점검 응답 코드를 준비해 두 Edge 함수에 배포한다. 모든 인증·학습·callback 경로가 DB를 열지 않고 `503`, `Cache-Control: no-store`를 반환해야 한다. | 운영·preview 직접 URL과 웹 프록시 모두 점검 응답. 점검 코드 자체의 검증·배포는 아직 미실행이다. |
| 2 | 구 함수 연결을 종료한 뒤 실제 runtime/writer 연결 0을 확인한다. 마지막 구 함수의 토큰 발급 가능 시각부터 최소 90초를 기다린다. 관리자 작업도 중단하고 최종 백업·보존 집합을 확보한다. | 기존 데이터 토큰의 최대 60초 수명과 검증기의 30초 시계 오차 범위를 지난 뒤 새 발급이 없는 상태. 대기만으로 DB 연결 종료를 대신하지 않는다. |
| 3 | 읽기 전용 preflight로 대상·기존 열·정의·건수를 다시 대조하고, `20260913040000_phone_free_access.sql` → `20260913050000_rename_provider_account_id.sql` 순서로 파일 전체를 실행한다. | 각 트랜잭션 성공, `provider_account_id(text)` 존재, 내부 UUID·외부 식별값·관계 보존, `phone-free-access.sql` 기대 결과 일치. 잠금 대기·정의 차이는 중단한다. |
| 4 | `529e1bb` 또는 이후 별도 검증한 최종 SHA의 웹 빌드를 Netlify에 연결한다. 웹을 연결하는 동안 두 Edge의 점검 응답을 유지하고 프록시 대상·Origin·callback을 적용표와 대조한다. | 새 웹 배포가 ready이고 두 Edge가 여전히 503을 반환한다. 새 웹의 DB·Edge 의존 요청은 다음 순서까지 점검 상태다. |
| 5 | 같은 SHA의 정상 Edge 두 개를 정확한 Origin으로 배포한다. **각 정상 함수 배포가 해당 진입점의 요청 재개**다. 재개 시각을 기록하고 준비된 계정으로 실제 동선을 즉시 확인한다. | 함수 버전·본문이 적용표와 맞고 구 writer 참조가 없다. 로그인·학습·이용권 안내·로그아웃·재로그인·code/state 제거와 401/403/404/503을 확인한다. 실패하면 두 함수 모두 점검 응답으로 되돌린다. 카카오 앱 전환은 4절 준비를 마친 경우에만 포함한다. |
| 6 | 구버전 두 함수·writer 연결이 없는지 확인하고 `SET aispeechfit.phone_retirement_ready='on'` 뒤 `supabase/operations/retire-phone-access.sql` 전체를 실행한다. | 예상 정책·역할·멤버십·의존성 검사 통과, 기존 자료 보존, 새 일반 인증·학습 동작 유지. |
| 7 | 프로젝트의 모든 활성 함수에서 미사용임을 재확인한 뒤 `AUTH_PHONE_DATABASE_URL`, `KAKAO_APP_ID` Secret과 로컬의 해당 값을 정리한다. Netlify의 미사용 `KAKAO_APP_ID`도 별도 대상으로 적는다. | 공용 인증 secret·DB 기본 연결·서명 키·카카오 키를 보존한다. 다른 함수 참조가 남으면 해당 제거를 중단한다. |
| 8 | 보존 집합과 정상 동선을 다시 대조하고 준비한 일반 계정·기기 결과를 기록한 뒤, 별도 승인한 7절 개인정보 처리를 수행한다. | 예상 밖 자료 차이가 0이고 남은 항목·이유·복원 가능 범위를 기록한다. main 병합·운영 공개·개인정보 폐기는 확인된 범위에서만 실행한다. |

점검 배포는 계획 단계의 후보이며 아직 코드·플랫폼 검증을 마치지 않았다. 실제 응답·신규 토큰 차단·두 진입점 차단을 확인하기 전에는 1번을 실행하지 않는다. 이 계획은 운영자만 우회할 수 있는 별도 접근 기능을 가정하지 않는다. 운영 계정의 실제 검증은 5번 요청 재개 이후 수행하며, 그 전에는 로컬 합성 검사·대상 설정·DB 보존 결과를 확인한다. 정상 함수 배포와 Netlify 잠금 해제는 서비스를 공개할 수 있으므로 적용 승인 범위에 포함한다.

실패 시에는 다시 두 Edge를 점검 응답으로 제한한 뒤 실패 위치를 기록한다. 개인정보·전용 권한이 남아 있는 시점에는 `supabase/rollback/20260913050000_rename_provider_account_id.sql` → `supabase/rollback/20260913040000_phone_free_access.sql` → 기존 Netlify deploy ID → 기존 Edge 두 개 순으로 맞춰 되돌린다. 이전 웹을 연결하는 동안에도 점검 응답을 유지하며, 이전 Edge를 배포하는 시점에 해당 진입점의 요청이 재개된다. 권한을 이미 회수했다면 비공개로 저장한 정확한 역할·정책·GRANT를 함께 복원해야 한다. `DROP OWNED`, `CASCADE`, RLS 해제·`GRANT ALL`은 사용하지 않는다.

개인정보 폐기 뒤에는 전화번호를 요구하는 옛 릴리스로 복원하지 않는다. 새 열·전화번호 없는 접근 정책·기본 역할과 최종 검증한 새 Edge/웹 조합을 복구 기준으로 유지하며, 정상 조합을 만들지 못하면 점검 응답을 유지한다. 폐기 전 백업을 복원하면 번호와 이력이 다시 나타나므로 그 경우 접근을 재개하기 전에 승인한 폐기 처리를 재적용해야 한다.

## 7. 개인정보 처리 대상과 SQL 초안

| 위치 | 이번 실측 | 보존·폐기 제안 |
| --- | --- | --- |
| 운영 `better_auth.kakao_identities` | 1행, 전화번호 값 1개 | 계정 출처 다섯 열과 FK를 보존하고 `phone_e164/status/version/checked_at`을 폐기하는 안이다. 실제 원본 앱 연결 결과와 함께 구조 변경 범위를 확인해야 한다. |
| 운영 `better_auth.kakao_session_checks` | 4행 | 승인한 확인 이력 4행을 삭제한다. 테이블·FK는 유지해 계정 관계의 불필요한 변경을 줄인다. |
| 로컬 55433 `auth_migration` | identity 1행·전화번호 1개·확인 이력 2행 | 운영과 별도의 폐기 대상이다. 로컬 계정 출처를 보존하며 운영 SQL을 그대로 실행하지 않는다. |
| 로컬 55432 `kakao_test` | identity 1행·전화번호 1개·확인 이력 1행 | `kakao_test_auth`의 구형 열·제약을 별도로 조사한 뒤 맞는 SQL로 처리한다. |
| 로컬 55433 이용권 이전 후보 | `auth_source.ticket_transfer_candidates` 1행 | 개인정보 삭제 대상에 포함하지 않고 기존 이용권 보존 근거로 남긴다. |
| 과거 Supabase Auth | 운영 `auth.users` 56행의 phone 값 0개, `auth.mfa_factors` 0행 | 이번 전화번호 폐기를 이유로 과거 사용자와 보관 이용권을 삭제하지 않는다. |
| 과거 snapshot 도구의 사본 | 조사한 세 DB 모두 `auth_source.snapshots/rows` 없음 | 다른 파일 사본·클라우드 로그·플랫폼 백업의 전체 부재를 뜻하지 않는다. 백업 보관 위치와 관련 로그의 보존 주기는 적용 전에 운영자가 정한다. |

다음 SQL은 **운영 계정 출처 다섯 열을 보존하는 후보를 검토하기 위한 초안**이며 자동 migration에 넣지 않는다. 실제 실행 전 예상 건수·의존성·소유자·정책과 원본 앱 연결 구조를 다시 확정한다. 현재는 마지막 문장이 `ROLLBACK`이므로 승인된 운영 폐기 파일을 대신하지 않는다. 전화번호 값을 NULL로 바꾸기만 하면 기존 phone/status CHECK와 version 트리거에 걸리므로 전용 확인 상태·트리거의 종료를 함께 다룬다.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE better_auth.kakao_identities, better_auth.kakao_session_checks IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF current_setting('aispeechfit.phone_disposal_ready', true) IS DISTINCT FROM 'on'
    OR to_regrole('better_auth_phone_writer') IS NOT NULL
    OR to_regprocedure('public.has_valid_auth_session(boolean)') IS NOT NULL
    OR to_regprocedure('public.has_valid_auth_session()') IS NULL THEN
    RAISE EXCEPTION 'ISSUE32_PHONE_DISPOSAL_NOT_READY';
  END IF;
  IF (SELECT count(*) FROM better_auth.kakao_identities) <> 1
    OR (SELECT count(*) FROM better_auth.kakao_identities WHERE phone_e164 IS NOT NULL) <> 1
    OR (SELECT count(*) FROM better_auth.kakao_session_checks) <> 4 THEN
    RAISE EXCEPTION 'ISSUE32_DISPOSAL_COUNTS_CHANGED';
  END IF;
END $$;
CREATE TEMP TABLE issue32_preserved_bindings ON COMMIT DROP AS
  SELECT user_id,account_id,provider_id,app_id,subject FROM better_auth.kakao_identities;
DELETE FROM better_auth.kakao_session_checks;
DROP TRIGGER guard_identity_version ON better_auth.kakao_identities;
DROP FUNCTION better_auth.guard_identity_version() RESTRICT;
ALTER TABLE better_auth.kakao_identities
  DROP COLUMN phone_e164 RESTRICT, DROP COLUMN status RESTRICT,
  DROP COLUMN version RESTRICT, DROP COLUMN checked_at RESTRICT;
DO $$ BEGIN
  IF EXISTS (
    (SELECT user_id,account_id,provider_id,app_id,subject FROM better_auth.kakao_identities
      EXCEPT SELECT * FROM issue32_preserved_bindings)
    UNION ALL
    (SELECT * FROM issue32_preserved_bindings
      EXCEPT SELECT user_id,account_id,provider_id,app_id,subject FROM better_auth.kakao_identities)
  ) THEN RAISE EXCEPTION 'ISSUE32_BINDINGS_CHANGED'; END IF;
END $$;
ROLLBACK;
```

이 SQL 초안은 운영에 실행하지 않았다. 계정 구조와 폐기 범위가 확정되면 새 PostgreSQL 15.8 합성 fixture에서 준비 미완료·건수 차이·추가 의존성의 실패 롤백, 다섯 식별 열·FK·이용권 보존과 전화번호 없는 OAuth/HTTP를 검증하고 실행 파일을 확정한다. 새 백업과 기존 사본의 폐기 시점도 별도 명시한다.

## 8. 검증 근거와 남은 확정

| 항목 | 현재 상태 | 완료에 필요한 것 |
| --- | --- | --- |
| 6~8번 커밋 | 완료 | 65개 변경 경로를 커밋 전후 바이트로 대조했고 커밋 직후 작업 폴더가 깨끗했다. |
| 기존 최종 검증 | 8번의 100/100·공개 설정 빌드·정적 검사 통과 | 앱 코드·잠금 파일은 그 검증 상태와 동일하다. 이번 문서 추가를 이유로 합계를 중복해서 늘리지 않는다. |
| 운영과 같은 PostgreSQL 버전 | 추가 HTTP 검사 12/12 통과 | `529e1bb`를 임시 폴더에 풀고 검사 DB 이미지만 `postgres:15.8-alpine`로 바꿨다. 신규 정책·열 정정·권한 회수와 실제 HTTP를 확인했으며 컨테이너·네트워크·폴더를 정리했다. |
| 운영 서명 설정 | 기존 로컬 ES256 공개 키·kid가 전용 signing-keys API의 standby 키와 일치 | PostgREST의 legacy `jwt_secret` 필드와 별도로 확인했다. 키를 회전하지 않았으며 실제 운영 HTTP 검증은 10번이다. |
| 전환 방식 | 기존 점검 시간 계획 유지 | 두 Edge·DB·웹 전환 순서와 실제 중단·재개 조건을 검증하고 시작 시각을 정한다. |
| 원본 앱·계정·기기 | 설정 준비 및 subject 확인 필요 | 원본 앱 로그인·동의항목·callback·시크릿, 계정 연결 방법, 일반 계정과 기기를 준비한다. |
| 백업·점검·복원 | 방법 초안 작성 | 보관 위치·보관 기한·실제 백업 복원과 플랫폼 번들/점검 응답 검증이 필요하다. |
| 기존 개인정보 폐기 | 대상 실측·SQL 후보 작성 | 운영·로컬 각각의 승인 범위와 식별 관계 구조를 확정하고 합성 환경 검증 후 실행 파일을 만든다. |

이번 운영 조회에는 데이터·스키마·권한 변경이 없다. 배포·Secret 변경·키 회전·원격 게시·실제 개인정보 폐기도 실행하지 않았다. 카카오 콘솔은 설정을 저장하지 않고 확인용으로 만든 탭만 닫았다. 9번의 미확정 사항이 해결되기 전에는 10번 적용 준비 완료로 기록하지 않는다.

## 9. 적용 파일 식별과 검토 자료

SHA `529e1bb`에서 아래 명령으로 적용·복원 파일의 해시를 생성해 실제 실행 파일과 대조한다. 해시가 달라지면 변경 내용을 재검토한다.

```sh
git rev-parse HEAD
git status --short
git diff --stat 029543863f9804d902bd81c68f8fa4450198d921..529e1bb
shasum -a 256 supabase/migrations/20260913040000_phone_free_access.sql supabase/migrations/20260913050000_rename_provider_account_id.sql supabase/operations/retire-phone-access.sql supabase/rollback/20260913050000_rename_provider_account_id.sql supabase/rollback/20260913040000_phone_free_access.sql
```

검토 설명 초안은 다음과 같다. “카카오 로그인 후 전화번호 확인이 없어도 실제 Better Auth 세션과 본인 유효 이용권으로 학습한다. OAuth 수집 범위·완료 화면·개발/관리 도구와 최소 권한을 함께 정리하고, 기존 계정 UUID·외부 식별값·이용권을 보존한다. 자동 검사 100개, 공개 설정 빌드와 정적 검사, 추가 PostgreSQL 15.8 HTTP 12개를 통과했다. DB 열 이름과 두 Edge 매핑은 점검 구간에서 함께 전환해야 하며 운영 적용·원본 앱 계정 연결·개인정보 폐기는 아직 실행하지 않았다.”

실제 PR 제목·본문과 적용표에는 새 PR 번호·최종 SHA·승인된 실행 범위·운영 검증 결과를 반영한다. 현재 없는 배포 ID와 검증 결과는 채워 넣지 않는다.
