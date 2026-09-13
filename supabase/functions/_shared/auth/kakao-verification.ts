import type { Pool } from "pg";
import type { KakaoAuth } from "./kakao.ts";
import { maskPhone } from "./phone.ts";

type Session = NonNullable<Awaited<ReturnType<KakaoAuth["api"]["getSession"]>>>;
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
