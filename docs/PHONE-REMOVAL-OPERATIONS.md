# 전화번호 제거 후 계정 보존과 운영 정리 명세

이슈 [#32](https://github.com/crontable/aispeechfit/issues/32)의 7번 산출물이다. 새 코드는 전화번호 없이 로그인·세션·이용권을 처리한다. 이 문서의 운영 변경은 9번에서 대상과 복원 기준을 확정하고 10번에서 실행한다. 현재 작업 폴더의 구현·격리 DB 검증과 운영 반영 상태를 구분한다.

## 1. 계정 식별 관계를 보존하는 위치

| 보존할 값 | 현재 저장 위치와 관계 | 이번 처리 |
| --- | --- | --- |
| 내부 사용자 UUID | `better_auth.users.id`를 `accounts.user_id`, `sessions.user_id`, `kakao_identities.user_id`, `public.tickets.user_id`가 참조한다. 사용자 한 명에 계정·세션·이용권 여러 행이 연결될 수 있다. | 사용자 재생성·이용권 재할당 없이 유지한다. |
| 내부 계정 UUID | `better_auth.accounts.id`를 `kakao_identities.account_id`가 참조한다. identity의 `account_id`는 UNIQUE다. | UUID와 외래 키를 유지한다. |
| 외부 회원 식별자 | `better_auth.accounts.provider_account_id(text)`에 저장한다. 기존 `account_id(text)`의 열 이름만 정정한다. | 4번의 050000 SQL과 새 Edge 매핑을 함께 적용한다. 기존 식별값은 그대로 둔다. |
| 카카오 앱과 회원의 연결 | `better_auth.kakao_identities(app_id, subject)`가 UNIQUE이며 `provider_id='kakao'`다. | 기존 행에 그대로 보존한다. 새 로그인은 이 행의 존재나 전화번호 확인 상태를 요구하지 않는다. |
| identity와 계정의 결합 | `(account_id,user_id,provider_id,subject)`가 `accounts(id,user_id,provider_id,provider_account_id)`를 복합 FK로 참조한다. | 제약을 해제하거나 subject만 덮어쓰지 않는다. |
| 과거 세션 확인 관계 | `kakao_session_checks(session_id,user_id)`는 `sessions(id,user_id)`를 참조하고 `user_id`는 identity를 참조한다. | 확인 기능과 읽기·쓰기 권한만 종료한다. 행 폐기는 9·10번의 별도 대상이다. |

`kakao_identities.user_id`는 기본 키이므로 현재 사용자당 identity는 한 행뿐이다. 원본 앱과 테스트 앱의 서로 다른 `(app_id,subject)` 두 쌍을 같은 사용자에게 추가 저장할 수 없다. 또한 `phone_e164`와 `status`는 CHECK 제약으로 결합되어 있고, `account_id`, `app_id`, `subject`, `phone_e164`, `status`를 바꾸면 version 증가 트리거가 적용된다. 전화번호만 NULL로 바꾸거나 상태를 임의로 확정하는 SQL을 만들지 않는다.

## 2. 원본 앱 확인 뒤 확정할 구조

앞선 읽기 전용 조사에서 원본 앱 `1195231`, 테스트 앱 `1195233`을 확인했다. 두 앱에서 반환하는 실제 회원 subject의 일치 여부는 아직 확인하지 않았다. 이번 단계에서는 기존 identity 행을 보존하는 구조를 유지하며 새 연결 테이블·자동 병합·계정 재할당을 구현하지 않는다.

| 9번에서 확인할 결과 | 필요한 처리와 완료 조건 |
| --- | --- |
| 원본 앱의 subject가 기존 외부 식별자와 같음 | 실제 응답의 앱·계정 출처를 확인하고 기존 사용자·계정·이용권 UUID가 유지되는지 검증한다. 기존 테스트 앱 쌍을 덮어쓰기 전에 두 출처를 남길 위치와 제약을 명세에 확정한다. |
| 원본 앱의 subject가 다름 | 같은 사람이라는 연결 근거와 사용자당 한 행 제약을 함께 검토한다. 기존 앱 쌍과 원본 앱 쌍을 모두 보존할 별도 연결 또는 보관 구조, 복합 FK·유일성·복원 SQL을 먼저 확정한다. 이메일 자동 병합과 새 계정으로의 이용권 이전은 하지 않는다. |
| 실제 원본 계정 확인 전 | 앱 전환과 identity 구조 변경을 미실행으로 둔다. 기본 전화번호 제거 검증은 기존 식별 관계를 그대로 둔 상태에서 진행한다. |

이 보존은 개인정보 폐기 완료를 뜻하지 않는다. `phone_e164`, 전화번호 확인 상태·버전·시각, 확인 행과 사본·백업·로그는 9번에서 존재 위치·실측 건수·보존 필요성·폐기 범위를 정하고 10번에서 처리한다. 기존 전화번호 기반 복원은 자료 폐기 후 사용할 수 없으므로 복원 기준도 함께 갱신한다.

## 3. 권한 정리 SQL과 실행 순서

`supabase/operations/retire-phone-access.sql`은 자동 마이그레이션 목록 밖의 수동 운영 SQL이다. 인증 기본 테이블의 `better_auth_runtime` 권한을 유지하고 전화번호 테이블 두 개의 runtime SELECT, writer 전용 정책·GRANT, `better_auth_phone_writer` 역할을 회수한다. 데이터·테이블·열·제약·트리거를 삭제하지 않는다. public 스키마의 형식도 바꾸지 않는다.

1. 9번에서 실제 DB·프로젝트·함수·적용 SHA·백업·담당자·시각을 기록한다. `pg_policies`, 테이블·열 GRANT, 역할 속성·멤버십·연결과 다른 DB의 역할 의존성을 읽기 전용으로 확인한다. 복원용 권한 정의와 보존 자료는 비공개로 보관한다.
2. 인증·학습 요청을 제한한 전환 구간에서 `20260913040000_phone_free_access.sql` → `20260913050000_rename_provider_account_id.sql` → 이에 맞는 Edge·Next.js 릴리스를 적용한다. 전화번호 writer를 쓰는 구버전 함수와 연결을 종료한 뒤 역할 회수로 넘어간다. DB 열과 Edge 매핑이 다른 상태로 요청을 재개하지 않는다.
3. 새 함수의 DB 연결과 로그인·로그아웃·세션·본인 이용권·학습 접근을 확인한다. SQL 실행 연결에서 아래 준비 표시를 설정한 뒤 `retire-phone-access.sql` 전체를 한 번에 실행한다. 준비 표시는 운영자가 앞선 확인을 마쳤음을 나타내는 입력이며, SQL 자체가 외부 배포 상태를 확인하지는 않는다.

   ```sql
   SET aispeechfit.phone_retirement_ready = 'on';
   ```

4. 예상 정책 정의·역할 표식·멤버십이 다르거나, writer 연결이 남았거나, 예상 밖 권한·의존성이 있으면 SQL 전체가 실패한다. SQL Editor/클라이언트가 실패한 트랜잭션을 유지하면 `ROLLBACK`으로 종료한다. 원인을 조사하고 정의를 다시 검토한다. `DROP OWNED`, `CASCADE`, RLS 해제로 통과시키지 않는다. 정상 재실행은 동일 상태로 끝난다.
5. 같은 프로젝트의 모든 활성 함수에서 참조가 사라졌는지 확인한 뒤 `AUTH_PHONE_DATABASE_URL`과 전화번호 전용 `KAKAO_APP_ID` Secret을 제거한다. 프로젝트 단위 Secrets라서 다른 함수에 미치는 영향도 확인한다. 실제 `.env*`의 폐기 대상 값도 이때 범위에 포함한다. 공용 로그인 비밀값·서명 키를 회전하지 않는다.
6. 역할·정책·GRANT 회수 결과와 일반 인증·학습 접근을 다시 확인한다. 기존 데이터 폐기는 별도 승인 범위에 따라 수행하고, 남긴 항목·사유·건수를 기록한다.

SQL만으로 Edge 배포를 확인하거나 Secrets를 삭제할 수 없다. 위 순서의 외부 작업을 SQL 성공으로 대체해 기록하지 않는다. 권한 복원은 요청을 제한한 상태에서 실제 적용 전 저장한 역할·정책·GRANT와 호환 릴리스를 복원한다. 종료한 옛 자동 전환 명령을 재사용하지 않는다.

## 4. 도구의 현재 역할

| 명령·코드 | 현재 동작과 유지 이유 |
| --- | --- |
| `/dev/kakao` | 개발 플래그와 `localhost:3000` 조건에서 공통 `/sign-in`으로 이동한다. 그 밖에는 404다. 전용 번호 수집 화면과 API가 없다. |
| `lib/kakao-test/auth.ts`, `http.ts` | 별도 로컬 DB에서 실제 Better Auth와 가상 카카오 응답을 연결하는 회귀 검사 도구다. Next.js의 `/api/auth`를 대체하지 않는다. |
| `kakao:setup`, `kakao:db`, `kakao:migrate`, `kakao:evidence` | 55432의 별도 OAuth 검증 DB를 준비하고 기본 인증 집계와 토큰 암호화 여부만 확인한다. 신규 초기화는 전화번호 테이블을 만들지 않는다. 기존 DB의 과거 자료는 지우지 않는다. |
| `auth-migration:setup`, `auth-migration:db`, `auth-schema:apply`, `auth-schema:evidence` | 55433의 인증 스키마 준비·검사에 쓴다. apply는 초기 인증 스키마와 계정 열 정정까지이며 public 접근 정책 전체 전환 명령이 아니다. |
| `auth-schema:runtime`, `auth-schema:preflight`, `auth-schema:cutover`, `auth-migration:prepare-ticket` | 이전 전화번호 역할 생성·선택 이용권 이전 명령은 사용을 종료했다. 환경·DB를 읽기 전에 실패 코드로 종료한다. |
| `auth-migration:inspect`, `auth-migration:snapshot` | 과거 Supabase Auth 원본 조사·스냅샷 도구다. 새 인증 전환의 선행 조건이 아니다. snapshot은 원격 원본을 읽고 로컬에 민감 자료 사본을 저장하므로 별도 보관·폐기 범위가 필요하다. |

기존 마이그레이션·rollback·verification SQL은 당시 상태와 복원 근거를 재현하는 이력이다. 기존 데이터가 있는 운영 DB에 timestamp 순서대로 전부 다시 실행하지 않는다. 전화번호 스키마를 재현하는 테스트 fixture와 부정 경로 검사는 기능이 다시 활성화되지 않음을 확인하기 위해 유지한다.

## 5. 검증 방법

`pnpm test:service-auth`는 임시 DB에서 적용 준비·스키마·정책 충돌·추가 권한·실행 중인 연결을 검사한다. 정상 회수 전후 전체 합성 행·UUID·외래 키·시퀀스를 대조하고 세션·이용권 접근 및 반복 적용을 검증한다. `pnpm test:auth-tools`는 임시 환경 파일에서 설정 보존·정렬·0600 권한과 종료 명령의 무변경 실패를 확인한다. `pnpm test:kakao`, `pnpm test:auth-schema`, `pnpm test:edge-auth`는 새 설정과 기본 OAuth를 검증한다. 로컬 SQL 역할 검사는 Data API HTTP 서명 검증과 실제 카카오 계정·기기 검증을 포함하지 않는다.
