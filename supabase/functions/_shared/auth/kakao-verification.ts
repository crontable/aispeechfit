import type { Pool } from "pg";
import type { KakaoAuth } from "./kakao.ts";
import {
  KakaoVerificationError,
  maskPhone,
  verifyKakaoProfile,
} from "./phone.ts";

type Session = NonNullable<Awaited<ReturnType<KakaoAuth["api"]["getSession"]>>>;
type Dependencies = {
  pool: Pool;
  auth: KakaoAuth;
  appId: string;
  fetchProvider?: typeof fetch;
};

export async function readKakaoStatus(pool: Pool, session: Session) {
  const { rows } = await pool.query(
    `
    SELECT i.status, i.phone_e164, i.checked_at,
      c.identity_version = i.version AND c.user_id = i.user_id AS session_checked
    FROM better_auth.kakao_identities i
    JOIN better_auth.sessions s ON s.id = $2 AND s.user_id = i.user_id AND s.expires_at > now()
    LEFT JOIN better_auth.kakao_session_checks c ON c.session_id = s.id
    WHERE i.user_id = $1`,
    [session.user.id, session.session.id],
  );
  const row = rows[0];
  return {
    status: row?.status ?? "pending",
    phoneMasked: maskPhone(row?.phone_e164 ?? null),
    checkedAt: row?.checked_at?.toISOString() ?? null,
    sessionChecked:
      row?.session_checked === true && row?.status === "confirmed",
  };
}

export async function verifyCurrentKakaoSession(
  deps: Dependencies,
  headers: Headers,
) {
  const session = await deps.auth.api.getSession({ headers });
  if (!session) throw new KakaoVerificationError("session_expired");
  const db = await deps.pool.connect();
  let errorCode: KakaoVerificationError["code"] | null = null;
  try {
    await db.query("BEGIN");
    // 같은 사용자의 원격 조회까지 직렬화하여 늦게 끝난 이전 응답의 덮어쓰기를 막는다.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      session.user.id,
    ]);
    const { rows: accounts } = await db.query(
      "SELECT id, account_id FROM better_auth.accounts WHERE user_id = $1 AND provider_id = $2",
      [session.user.id, "kakao"],
    );
    if (accounts.length !== 1)
      throw new KakaoVerificationError("account_mismatch");
    const account = accounts[0];
    let phone: string | null = null;
    try {
      const token = await deps.auth.api.getAccessToken({
        headers,
        body: { accountId: account.id },
      });
      if (!token.accessToken)
        throw new KakaoVerificationError("provider_unavailable");
      const providerFetch = deps.fetchProvider ?? fetch;
      const get = async (path: string) => {
        const response = await providerFetch(`https://kapi.kakao.com${path}`, {
          headers: { Authorization: `Bearer ${token.accessToken}` },
          signal: AbortSignal.timeout(8_000),
          cache: "no-store",
          redirect: "error",
        });
        if (!response.ok)
          throw new KakaoVerificationError("provider_unavailable");
        return response.json() as Promise<unknown>;
      };
      const tokenInfo = await get("/v1/user/access_token_info");
      const profile = await get("/v2/user/me");
      phone = verifyKakaoProfile(tokenInfo, profile, {
        appId: deps.appId,
        subject: account.account_id,
      });
    } catch (error) {
      errorCode =
        error instanceof KakaoVerificationError
          ? error.code
          : "provider_unavailable";
    }
    // 조회 중 로그아웃되었다면 쓰기를 거부한다. 이 잠금은 커밋까지 세션 삭제와 경합한다.
    const live = await db.query(
      "SELECT id FROM better_auth.sessions WHERE id = $1 AND user_id = $2 AND expires_at > clock_timestamp() FOR SHARE",
      [session.session.id, session.user.id],
    );
    if (!live.rowCount) throw new KakaoVerificationError("session_expired");
    const status = phone
      ? "confirmed"
      : errorCode === "provider_unavailable"
        ? "pending"
        : "unavailable";
    const { rows } = await db.query(
      `
      INSERT INTO better_auth.kakao_identities AS previous (user_id, app_id, subject, phone_e164, status, account_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        app_id = excluded.app_id, subject = excluded.subject, account_id = excluded.account_id,
        phone_e164 = excluded.phone_e164, status = excluded.status, checked_at = now(),
        version = previous.version + CASE WHEN
          (previous.app_id, previous.subject, previous.phone_e164, previous.status, previous.account_id)
          IS DISTINCT FROM (excluded.app_id, excluded.subject, excluded.phone_e164, excluded.status, excluded.account_id)
          THEN 1 ELSE 0 END
      RETURNING version`,
      [
        session.user.id,
        deps.appId,
        account.account_id,
        phone,
        status,
        account.id,
      ],
    );
    if (phone) {
      await db.query(
        `INSERT INTO better_auth.kakao_session_checks (session_id, user_id, identity_version)
        VALUES ($1, $2, $3) ON CONFLICT (session_id) DO UPDATE
        SET identity_version = excluded.identity_version, checked_at = now()`,
        [session.session.id, session.user.id, rows[0].version],
      );
    } else {
      await db.query(
        "DELETE FROM better_auth.kakao_session_checks WHERE user_id = $1",
        [session.user.id],
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  return { ...(await readKakaoStatus(deps.pool, session)), errorCode };
}
