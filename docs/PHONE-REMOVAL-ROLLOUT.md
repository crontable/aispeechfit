# 전화번호 제거의 운영 적용 결과

이슈 [#32](https://github.com/crontable/aispeechfit/issues/32)의 **운영 DB·웹·인증 함수 반영과 운영 전화번호 기록 폐기를 완료했다.** 운영 PostgreSQL에서 `better_auth.accounts.provider_account_id(text)`가 존재하고 이전 외부 식별자 열 `account_id(text)`는 없어졌다. `accounts.id`와 `kakao_identities.account_id`의 내부 UUID는 보존했다. `kakao_identities`는 계정 출처 다섯 열만 남았으며 전화번호 확인 이력은 0행이다.

최종 운영 읽기 전용 확인 시각은 **2026-09-14 00:59:14 KST**다. 기존 이용권 계정으로 운영 카카오 로그인 → 학습 목록 → 기능해부학 문항 → 새로고침 → 로그아웃 → 접근 차단 → 재로그인을 실제 브라우저에서 확인했다. 운영 전화번호 폐기 후에도 문항과 새로고침을 확인했다. 두 로컬 DB의 전화번호 자료도 01:09:19 KST까지 폐기했다. 2026-09-14 오후에 카카오 로그인을 **원본 앱 1195231**로 전환했다. 운영자가 실가입자 없음을 확인하고 테스트 앱 계정의 subject 대조·연결을 생략하기로 결정했다. 일반 계정·iOS·Android 실기기 확인은 남아 있으므로 이슈 전체 완료로 표시하지 않는다.

## 1. 현재 적용된 조합

| 대상 | 실제 상태 | 확인 기준 |
| --- | --- | --- |
| 브랜치·앱 코드 | `feat/32-remove-phone-collection`, `75986b7e964876781fd4e31db7c016187523fb32` | 앱·의존성은 검증한 커밋으로 배포했다. 이후 추가한 폐기 SQL·검사·운영 기록은 작업 폴더에 있다. |
| Supabase | `bovbypbhuuhasrkwpfld`, 서울, DB `postgres`, PostgreSQL 15.8 | 세션 풀러 5432·프로젝트 사용자·DB와 TLS 인증서를 고정했다. |
| 운영 Edge | `service-auth-v1`, **버전 6**, ACTIVE | 본문 SHA-256 `c619ea99f92b495620c634a544ca8516b39693df68ab87e3df0c40404ee18892`. 정상 코드 배포 당시 5였고 Secret 정리 후 6으로 갱신됐으며 본문 해시는 같다. |
| 미리보기 Edge | `service-auth-preview-v1`, **버전 4**, ACTIVE | 본문 SHA-256 `a46a8506168d35ba9b84a2e5523f85cc5ddd0a41d6672571f569babe68375a6b`. 정상 코드 배포 당시 3이었고 최종 조회는 4, 본문 해시는 같다. |
| 운영 웹 | `6aa6c09c9db8fbe550656322`, 공개 완료 | `https://aispeechfit.crontables.com`, 2026-09-14 00:27:07 KST 공개. |
| 미리보기 웹 | `6aa6c2253dd492851755a787`, ready | `https://deploy-preview-30--aispeechfit.netlify.app`, 00:33:34 KST 업로드 확인. 새 PR 번호를 만들거나 이슈 번호를 Origin에 대입하지 않았다. |
| Netlify 사이트 | `aispeechfit`, `dabab915-aaa1-4163-afcd-e598d29f7d2a` | 현재 공개된 새 배포의 production 잠금은 true다. 기존 main의 구 코드가 변경된 DB 위에 자동 공개되는 것을 막기 위해 유지한다. 사이트 이용 자체는 가능하다. |
| 카카오 앱 | 원본 앱 `1195231`의 client ID·secret | Supabase Function Secrets `KAKAO_CLIENT_ID`·`KAKAO_CLIENT_SECRET`과 Netlify 사이트 환경 변수 `KAKAO_CLIENT_ID`를 Management API로 갱신했다. 운영·미리보기 웹의 로그인 시작 API가 반환한 카카오 인가 화면이 앱 이름 aispeechfit을 표시하고 KOE 오류가 없음을 확인했고, 운영자가 실제 로그인을 확인했다. 저장소 `.env`의 `KAKAO_CLIENT_ID`는 로컬 개발용 테스트 앱 값으로 둔다. |
| 종료된 설정 | Supabase `AUTH_PHONE_DATABASE_URL`·`KAKAO_APP_ID`, Netlify 사이트 `KAKAO_APP_ID`, 로컬 대응값 제거 | 기본 DB 연결·공용 인증 secret·서명 키·카카오 client ID/secret과 나머지 설정은 보존했다. |

선행 PR [#31](https://github.com/crontable/aispeechfit/pull/31)은 준비 당시 OPEN이며 기준 `0295438`이 이 브랜치의 조상이었다. 이번 작업에서 새 원격 PR·push·main 병합·이슈 닫기는 수행하지 않았다. **향후 production 잠금 해제 전에는 실제 main에 새 DB 열·전화번호 없는 인증 코드가 포함됐는지 확인하고 해당 배포를 검증해야 한다.**

## 2. 운영에서 실행한 순서와 SQL

- [x] **1. 백업·복원을 검증하고 점검 응답으로 전환했다.** 승인된 백업을 생성하고 네트워크 없는 PostgreSQL 15.8에 복원해 13개 테이블 전체 행 일치를 확인했다. 기존 Netlify 공개를 잠근 뒤 두 Edge를 DB 접근 없는 503·no-store 점검 응답으로 배포했다. 운영·미리보기의 직접 URL과 웹 프록시에서 점검 응답을 확인한 시각은 2026-09-14 00:11:24 KST다.
- [x] **2. 구 연결과 토큰을 정리한 뒤 기존 행을 재대조했다.** runtime/writer DB 연결 0과 마지막 구 함수 토큰 발급 가능 시점 이후 최소 90초 경과를 확인했다. 원본과 복원본의 정렬 차이를 제거한 동일 JSON 비교 방식으로 백업 당시 13개 테이블을 다시 대조했다.
- [x] **3. 접근 정책과 외부 식별자 열 이름을 실제 DB에 적용했다.** 아래 두 migration을 순서대로 파일 전체 실행하고 각각 COMMIT을 확인했다. 첫 SQL은 전화번호 조건을 제거하면서 실제 세션·본인 이용권·RLS를 유지한다. 두 번째는 외부 계정 식별자 열 이름만 변경한다.
- [x] **4. 새 웹과 인증 함수를 연결했다.** 확정 커밋을 환경 파일 없이 임시 작업 폴더에 풀어 Netlify CLI 27.5.2·Next.js 어댑터 5.15.13으로 배포했다. CLI가 먼저 생성한 실제 배포 ID를 빌드의 `DEPLOY_URL`로 사용하고 production/preview의 인증 Origin과 함수 URL을 각각 고정했다. 운영 함수는 00:22:29, 미리보기 함수는 00:35:41 KST에 정상 코드로 재개했다. 웹까지 포함한 두 환경의 16개 응답 검증은 00:35:57에 통과했다.
- [x] **5. 전화번호 전용 권한을 회수했다.** `SET aispeechfit.phone_retirement_ready='on'` 후 `supabase/operations/retire-phone-access.sql` 전체를 실행했다. 00:41:46 KST COMMIT과 역할·정책·열별 권한 제거를 확인했고, 호출 제한 카운터를 제외한 12개 테이블의 적용 전후 행이 같았다.
- [x] **6. 미사용 설정을 제거했다.** 활성 Edge 두 개의 실제 본문 해시와 배포 소스 전체에서 미사용을 확인한 뒤 위 표의 설정만 제거했다. 00:46:21 KST까지 재조회·나머지 설정 보존·양쪽 health와 상태 API의 200 응답을 확인했다.
- [x] **7. 운영 전화번호 자료를 폐기했다.** 격리 PostgreSQL 15.8에서 새 폐기 SQL의 정상 처리·실패 롤백·FK·행 보존과 실제 HTTP를 검증한 뒤 실행 범위를 승인받았다. `SET aispeechfit.phone_disposal_ready='on'` 후 `supabase/operations/dispose-phone-records.sql` 전체를 실행해 00:57:39 KST에 COMMIT했다. 전화번호 값 1개와 확인 이력 4행을 폐기하고 `phone_e164/status/version/checked_at` 및 관련 version 트리거·함수를 제거했다. 식별 관계 다섯 열과 기존 PK·UNIQUE·FK는 보존했다.

| SQL | 실제 COMMIT 시각, KST | SHA-256 |
| --- | --- | --- |
| `20260913040000_phone_free_access.sql` | 2026-09-14 00:15:35.813 | `dade761309f5a577a917b3784e0e79c59f30f4c3f2c2f33b01c613de09cd3457` |
| `20260913050000_rename_provider_account_id.sql` | 2026-09-14 00:15:35.844 | `9f452728e9f2923a3da0cf419c1c483f796e9f0c989a95cf91d908a7a77012a8` |
| `retire-phone-access.sql` | 2026-09-14 00:41:46.261 | `7e2cc2e5e5b293bbbfb20930051d213086a851f634d85eeaca804b044164c6fe` |
| `dispose-phone-records.sql` | 2026-09-14 00:57:39.434 | `58faa6af401c48a39fcc274c92a4396665c943362c41944b6476127f2a5579a0` |

운영 점검 시간은 당초 안내한 5~10분보다 길어졌다. Netlify 빌드 입력 오류로 운영 웹이 00:27까지, 미리보기는 정상 함수 재개인 00:35까지 점검·장애 상태를 거쳤다. DB 열을 되돌리거나 보안 검사를 완화하지 않고 배포 입력을 수정했다. 아래 실패 원인에 최초 실패와 복구를 함께 남긴다.

## 3. 보존한 자료와 최종 검증

| 대상 | 00:59 KST 실측 | 보존 결과 |
| --- | --- | --- |
| `better_auth.users/accounts` | 각 1행 | 사용자·계정 UUID·제공자 식별값 보존. 실제 로그인으로 갱신되는 토큰·시각은 정상 인증에 따른 변경이다. |
| `better_auth.sessions` | 6행, 유효 2행 | 전환 직전 만료 4행을 보존했다. 이후 실제 로그인·로그아웃에 따라 세션이 생성·철회됐다. |
| `kakao_identities` | 1행, 식별 열 5개 | `user_id/account_id/provider_id/app_id/subject`, 계정 결합 FK와 유일성 보존. 연결 불일치 0. |
| `kakao_session_checks` | 0행 | 승인한 확인 이력 4행 폐기. 테이블·FK는 유지했다. |
| `public.tickets` | 1행 | ID·소유자·시작·만료·활성 상태·기존 시각을 보존했다. 이용권 재할당·기간 연장은 없다. |
| 학습 자료 | books 2, chapters 17, questions 662행 | 전체 자료와 교재·챕터 관계 보존. 실제 기능해부학 챕터에서 22문항 조회. |
| `auth_source.tickets` | 31행 | 기존 보관 이용권을 보존하고 다시 이전하지 않았다. |
| 과거 `auth.users` | 56행 | FK 참조 자료를 보존했다. 사전 조사 때 phone 값은 0개였다. |

운영 migration 직후에는 13개 테이블 전체 행이 일치했고, `supabase/verification/phone-free-access.sql`의 일곱 구조 검사와 계정·이용권 연결 불일치 0을 확인했다. 권한 회수에서는 12개 테이블 전체 행 일치를, 개인정보 폐기에서는 식별 다섯 열과 확인 이력을 제외한 자료의 적용 전후 일치를 각각 별도 대조했다. 실제 로그인 이후의 전체 행을 과거와 무조건 동일하다고 표시하지 않는다.

운영·미리보기의 직접 Edge와 웹 프록시에서 상태 조회 200, 비로그인 학습 API 401, 외부 Origin의 인증 POST 403, 폐기한 직접 전화번호 API 404와 no-store를 확인했다. 최종 폐기 뒤에도 두 health·웹 상태 API의 200과 비로그인 학습 차단 401을 확인했다. 실제 브라우저에서는 현재 테스트 앱의 기존 이용권 계정으로 로그인·문항 조회·새로고침·로그아웃·차단·재로그인을 확인했고 최종 URL에 OAuth code/state가 남지 않았다. 일반 계정·미리보기의 실제 로그인·iOS·Android 동선은 완료 근거에 포함하지 않는다.

새 폐기 검사는 `node --test tests/service-auth/phone-disposal.test.mjs`로 실행한다. PostgreSQL 15.8과 합성 자료만 사용하여 준비 표시 누락, 예상 건수 차이, 전화번호 열의 추가 뷰 의존성에서 전체 롤백하고, 정상 처리에서는 식별 관계·다른 행·본인 이용권 기반 HTTP 접근을 보존해 **6/6** 통과했다. 추가 뷰를 CASCADE로 제거하지 않으며 실패 후에도 그 뷰가 남음을 확인한다. `tests/data-api/fixture.mjs`는 허용한 PostgreSQL 17·15.8 이미지만 선택할 수 있도록 했고 기본값은 17로 유지했다. 새 파일 린트와 diff 검사가 통과했다.

두 로컬 DB 전용 SQL은 `node --test tests/service-auth/local-phone-disposal.test.mjs`로 지정 DB 외 적용 거부와 각 식별 관계·OAuth 기본 행 보존을 검증해 **4/4** 통과했다. 검사 준비 도구의 PostgreSQL 선택지를 추가한 뒤 기존 기본 경로도 `pnpm test:data-api`로 실행해 **12/12** 통과했다. 임시 컨테이너·네트워크는 정리됐다. 기존 8번의 자동 검사 100/100·공개 설정 빌드·정적 검사, 추가 PostgreSQL 15.8 HTTP 12/12, 점검용 HTTP 56/56, 계정 대조 도구 8/8은 당시 근거로 유지한다. 실행 시점이 다른 수치를 합쳐 새 총합으로 쓰지 않는다.

## 4. 발견한 실패와 수정·확인 범위

1. **Netlify 플러그인 경로와 배포 옵션.** 임시 어댑터의 절대 경로가 프로젝트 상대 경로로 해석돼 빌드 전에 실패했다. 패키지 이름과 임시 설치 경로를 연결해 해결했다. CLI 27.5.2에서 `--no-build`와 `--context` 조합은 허용되지 않아 해당 업로드 시도는 시작 전에 중단됐다.
2. **운영 웹의 DEPLOY_URL 형식 오류.** 미리 빌드한 산출물에 canonical Origin을 DEPLOY_URL로 넣었으나 `lib/service/config.ts`는 실제 24자리 배포 ID의 Netlify permalink만 허용한다. Edge 직접 요청은 통과하고 웹 프록시만 503인 상태를 확인했다. CLI가 배포 ID를 먼저 만들고 이어 빌드하도록 바꿔 실제 permalink를 사용했으며, 수정 배포 후 웹도 통과했다. 배포 URL 검사는 유지했다.
3. **미리보기 빌드에 운영 인증 주소가 주입됨.** 배포 컨텍스트만 지정한 빌드에서 실제 산출물의 BETTER_AUTH_URL이 운영 주소로 확인됐다. 빌드 명령에서 BETTER_AUTH_URL·AUTH_FUNCTION_URL·NEXT_PUBLIC_SITE_URL·DEPLOY_PRIME_URL을 해당 환경의 공개 주소로 고정하고, DEPLOY_URL은 CLI가 생성한 값을 유지했다. 최종 산출물과 두 실제 Origin의 응답을 확인했다.
4. **운영 문항 조회의 504.** 00:48:01 KST에 Supabase API gateway가 `/rest/v1/questions`에 504를 반환했고 00:48:06에 Edge가 `learning_data/DATA_UNAVAILABLE`를 기록했다. 화면은 정해진 장애 안내로 이동했다. 같은 시간대의 조회 가능한 DB·연결 풀 로그에는 시간 초과·취소·ERROR 결과가 없었다. 이후 같은 챕터 조회·새로고침과 재로그인, 개인정보 폐기 뒤 문항 조회가 성공했다. 확인된 실패 지점은 Data API의 504이며, 내부 시간 초과의 더 깊은 원인까지 확정하거나 영구 수정됐다고 표시하지 않는다.
5. **계정 대조용 테스트 앱 callback 누락.** 원본 앱의 실제 인증은 성공했지만 테스트 앱은 KOE006을 반환했다. 카카오 오류 설명과 테스트 앱 1195233의 REST API 키 `4121778` 설정에서 임시 callback 누락을 확인했다. 운영자가 해당 주소를 저장한 뒤 재시도했으나 테스트 앱은 같은 KOE006을 반환했다. 운영자가 실가입자 없음을 확인하고 subject 대조·연결 없이 원본 앱으로 전환하기로 결정했으므로 대조는 완료하지 않았다.

6. **새 로컬 폐기 검사의 연결 설정 복사.** 첫 검사는 1/4 통과 후 새 합성 DB 연결에서 SCRAM 비밀번호 타입 오류가 발생했다. 설치된 pg-pool이 비밀번호를 비열거형 속성으로 보관하므로 객체 전개에서 빠진 것이 원인이었다. 합성 비밀번호를 해당 속성에서 명시적으로 전달한 뒤 4/4 통과했다. 실제 55432·55433 DB의 적용은 이 검증이 통과한 뒤 수행했다.

이전의 연결 종료 경합, 함수 인자 충돌, 검사 환경·출처 오류, 백업 복원 준비 경합과 정렬 차이는 이슈의 기존 실패 기록에 보존한다. 새로고침에서 브라우저 자체의 로드 실패가 발생한 경우도 있었으며, 재요청 성공을 그 실패의 원인 규명으로 대체하지 않는다.

## 5. 백업과 현재 복구 기준

승인된 백업 폴더는 `~/Library/Application Support/aispeechfit/backups/issue32/20260913T144230629Z/`다. 폴더 0700·파일 0600, 별도 파일 암호화 없음, 생성부터 7일 보관으로 승인받았다. 생성 시각은 2026-09-13 23:42:30.629 KST, 만료는 **2026-09-20 23:42:30.629 KST**다. 같은 날 23:43에 정확한 폴더와 보관 표식을 확인해 폐기하는 자동 작업 `32`를 등록했다. 실패 알림을 확인하며 실제 삭제 전에는 백업 폐기 완료로 쓰지 않는다.

동일한 읽기 전용 snapshot에서 만든 `application.dump`는 better_auth·public·auth_source, `auth-schema.dump`는 참조 대상 정의, `auth-users.dump`는 과거 auth 사용자 56행을 담는다. 별도로 이전 역할·권한, 필요한 복구 설정, 구 Edge 본문을 승인된 범위에서 보관했다. PostgreSQL 15.8의 네트워크 없는 tmpfs 컨테이너에 복원해 13개 테이블의 전체 행과 FK·계정·이용권 연결을 대조했다. 검사용 역할은 NOLOGIN·no-owner로 만들어 운영 로그인 자격을 복제하지 않았다. 임시 DB 컨테이너·네트워크와 dump용 인증 파일은 정리했다.

**운영 전화번호 폐기 이후의 복구 기준은 현재의 전화번호 없는 릴리스다.** 이전 웹 `6aa63d4f9ab44b0008557487`와 옛 전화번호 필수 Edge를 단독으로 되돌리지 않는다. 장애 시 두 Edge를 점검 응답으로 제한하고 현재 DB·새 웹·같은 본문의 정상 Edge 조합을 복구한다. 백업 복원이 필요하면 전화번호가 다시 나타나므로 접근 재개 전에 승인된 폐기 처리를 다시 적용해야 한다. 역할 복원이 필요한 상황에서는 보관한 정확한 정의만 사용하며 DROP OWNED·CASCADE·GRANT ALL·RLS 해제는 사용하지 않는다.

복구용 백업에는 폐기 전 전화번호가 만료일까지 남는다. 운영 DB의 폐기 완료와 모든 사본의 폐기 완료를 구분한다. Supabase 조회 당시 플랫폼 백업 목록은 비어 있고 PITR은 꺼져 있었으나 이를 전체 로그·모든 외부 사본의 부재로 확대하지 않는다.

## 6. 이어서 처리할 체크리스트

- [x] **1. 원본 앱으로 전환했다.** 2026-09-14 오후에 Supabase Function Secrets `KAKAO_CLIENT_ID`·`KAKAO_CLIENT_SECRET`과 Netlify `KAKAO_CLIENT_ID`를 원본 앱 1195231 값으로 갱신했다. 두 Edge는 같은 Secrets를 읽으므로 운영·미리보기가 함께 바뀌었고 웹 재배포는 필요 없었다. 운영·미리보기의 로그인 시작 API가 반환한 인가 화면의 앱 이름과 redirect_uri를 확인했고 운영자가 실제 로그인을 확인했다.
- [x] **2. 계정 대조·연결은 생략했다.** `verify-provider-link.mjs`로 원본 앱 인증은 통과했으나 테스트 앱은 callback 저장 뒤에도 KOE006을 반환했다. 운영자가 카카오 실가입자가 없음을 확인하고 대조·연결 없이 전환하기로 결정했다. 테스트 앱 subject로 저장된 `better_auth` 사용자·계정 1건과 그 이용권은 DB에 남아 있으며 원본 앱 로그인은 새 계정을 만든다. 남은 행의 삭제 또는 이용권 이전은 별도로 정한다.
- [ ] **3. 일반 계정과 실기기 동선을 확인한다.** 원본 앱의 관리자·테스터가 아닌 계정으로 번호 없는 가입·이용권 없음·로그아웃·재로그인을 확인한다. Android에서 공유 링크 → 카카오 로그인 → 복귀 → 새로고침을 확인하고 iOS는 실제 기기를 확보한 뒤 기록한다. 현재 확인은 데스크톱 브라우저의 기존 이용권 계정이며 실기기 완료로 대신하지 않는다.
- [x] **4. 두 로컬 DB의 과거 전화번호 사본을 별도로 처리했다.** 실행 직전 55433 `auth_migration`의 전화번호 1개·확인 이력 2행과 55432 `kakao_test`의 전화번호 1개·확인 이력 1행, 다른 연결 0을 재확인했다. 격리 검증 후 승인받은 `supabase/operations/dispose-local-phone-records.sql`을 적용해 각각 2026-09-14 01:09:18.800·01:09:19.229 KST에 COMMIT했다. 운영을 포함한 세 DB에서 전화번호 값 총 3개·확인 이력 총 7행을 폐기했다. 55433의 외부 식별자 열도 검증한 rename migration으로 `provider_account_id`에 맞췄다. 기존 사용자·계정·세션과 55433의 `auth_source.ticket_transfer_candidates` 1행은 보존했다. 로컬 식별 출처는 각각 5개·3개 열로 남았고, PK·UNIQUE·FK와 그 밖의 모든 기존 테이블 행이 같았다. 로컬 폐기 자료의 새 사본은 만들지 않았다.
- [ ] **5. 임시 callback과 남은 사본을 정리한다.** 이번에 추가한 테스트 앱 1195233의 43932 callback을 제거한다. 대조 도구는 종료했다. 기존 원본 앱의 임시 callback·기존 파일 사본은 소유자와 범위를 확인해 처리한다. 7일 백업은 등록된 기한에 실제 삭제됐는지 확인한다.

## 7. 재현·검토 명령

`supabase db push`·`supabase db reset`으로 포괄 적용하지 않는다. 이미 실행한 폐기 SQL은 기존 전화번호 열과 정확한 건수를 전제로 하므로 완료된 운영 DB에 반복 실행하지 않는다. 지금 상태의 확인은 열 목록·권한·집계·`supabase/verification/phone-free-access.sql`을 읽기 전용으로 조회한다.

```sh
git rev-parse HEAD
git status --short
shasum -a 256 supabase/migrations/20260913040000_phone_free_access.sql supabase/migrations/20260913050000_rename_provider_account_id.sql supabase/operations/retire-phone-access.sql supabase/operations/dispose-phone-records.sql
node --test tests/service-auth/phone-disposal.test.mjs
node --test tests/service-auth/local-phone-disposal.test.mjs
pnpm test:data-api
pnpm exec eslint tests/data-api/fixture.mjs tests/service-auth/phone-disposal.test.mjs
git diff --check
```

Secret 삭제는 [Supabase의 이름 지정 삭제 API](https://supabase.com/docs/reference/api/v1-bulk-delete-secrets)와 [Netlify의 사이트 범위 환경 변수 API](https://open-api.netlify.com/#operation/deleteEnvVar)를 사용했다. 함수·API 장애는 [Supabase 로그 조회 명세](https://supabase.com/docs/guides/observability/advanced-log-filtering)에 따라 필요한 시각·실패 단계·경로·상태만 확인했다. 공개 기록에는 개인정보 원문·쿠키·토큰·연결 비밀번호를 남기지 않는다.

공개 이슈에 내부 운영 메타데이터를 포함한 상세 본문을 보내는 요청은 자동 승인 검토에서 공개 범위 확인을 이유로 거부됐다. 상세 적용 자료는 이 문서에 보존하고 공개 본문을 완료 여부·변경 파일·실패 원인·남은 절차로 줄여 2026-09-14 01:15:01 KST에 갱신한 뒤 다시 읽어 일치를 확인했다. 운영 검증 탭을 정리하고 이번 작업의 43932번 임시 서버가 종료됐음을 확인했다. 테스트 앱 callback 입력은 저장하지 않았으며 승인 대기 상태다.
