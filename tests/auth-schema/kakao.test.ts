import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Pool } from "pg";
import { createKakaoAuth } from "../../lib/auth/kakao.ts";
import { getLocalAuthConfig } from "../../lib/auth/local-config.ts";
import { TEST_ORIGIN } from "../../lib/kakao-test/config.ts";
import { handleAuthTestRequest } from "../../lib/kakao-test/http.ts";
import {
  readKakaoStatus,
  verifyCurrentKakaoSession,
} from "../../lib/auth/kakao-verification.ts";

test("실제 Better Auth·PostgreSQL과 가상 카카오 응답으로 인증 경계를 검증한다", async (t) => {
  process.env.KAKAO_AUTH_TEST_ENABLED = "true";
  const config = getLocalAuthConfig({
    ...process.env,
    KAKAO_APP_ID: "123",
    KAKAO_CLIENT_ID: "fixture-client",
    KAKAO_CLIENT_SECRET: "fixture-secret",
  });
  const database = `kakao_fresh_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: config.databaseUrl, max: 1 });
  await admin.query(`CREATE DATABASE ${database}`);
  const url = new URL(config.databaseUrl);
  url.pathname = `/${database}`;
  const pool = new Pool({
    connectionString: url.href,
    options: "-c search_path=better_auth,pg_catalog",
    max: 6,
  });
  const originalFetch = globalThis.fetch;
  try {
    await pool.query(
      readFileSync(
        "supabase/migrations/20260913000000_create_better_auth.sql",
        "utf8",
      ),
    );
    const auth = createKakaoAuth(pool, config);
    const fixtureToken = "fixture-access-token-never-real";
    let remoteProfile = {
      id: 456,
      kakao_account: {
        email: "fixture@example.com",
        is_email_valid: true,
        is_email_verified: true,
        profile: { nickname: "Fixture" },
        phone_number: "+82 010-1234-5678",
        phone_number_needs_agreement: false,
      },
    };
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === "https://kauth.kakao.com/oauth/token")
        return Response.json({
          access_token: fixtureToken,
          token_type: "bearer",
          refresh_token: "fixture-refresh-token",
          expires_in: 3600,
          refresh_token_expires_in: 86400,
          scope: "account_email profile_nickname phone_number",
        });
      if (url === "https://kapi.kakao.com/v2/user/me")
        return Response.json(remoteProfile);
      if (url === "https://kapi.kakao.com/v1/user/access_token_info")
        return Response.json({ id: 456, app_id: 123 });
      throw new Error("Unexpected fixture network request");
    };
    const cookieJar = new Map<string, string>();
    const saveCookies = (response: Response) => {
      for (const cookie of response.headers.getSetCookie()) {
        const [entry] = cookie.split(";");
        const split = entry.indexOf("=");
        cookieJar.set(entry.slice(0, split), entry.slice(split + 1));
      }
    };
    const headers = () => {
      return new Headers({
        host: "localhost:3000",
        origin: TEST_ORIGIN,
        "content-type": "application/json",
        cookie: Array.from(cookieJar)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      });
    };
    const request = (path: string, method: string, body?: unknown) =>
      new Request(TEST_ORIGIN + "/api/auth" + path, {
        method,
        headers: headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const login = async () => {
      const start = await handleAuthTestRequest(
        request("/sign-in/social", "POST", {
          provider: "kakao",
          callbackURL: "/dev/kakao",
          errorCallbackURL: "/dev/kakao?login_error=1",
        }),
        () => auth,
      );
      assert.equal(start.status, 200);
      saveCookies(start);
      const authorize = new URL((await start.json()).url);
      assert.equal(authorize.origin, "https://kauth.kakao.com");
      assert.equal(
        authorize.searchParams.get("redirect_uri"),
        TEST_ORIGIN + "/api/auth/callback/kakao",
      );
      assert.ok(authorize.searchParams.get("scope")?.includes("phone_number"));
      const callback = await handleAuthTestRequest(
        request(
          "/callback/kakao?code=fixture&state=" +
            authorize.searchParams.get("state"),
          "GET",
        ),
        () => auth,
      );
      saveCookies(callback);
      assert.equal(callback.status, 302);
      assert.equal(
        new URL(callback.headers.get("location")!, TEST_ORIGIN).href,
        TEST_ORIGIN + "/dev/kakao",
      );
      const session = await auth.api.getSession({ headers: headers() });
      assert.ok(session);
      return session;
    };
    globalThis.fetch = fakeFetch;
    const session = await login();
    const deps = { pool, auth, appId: config.appId, fetchProvider: fakeFetch };

    await t.test(
      "OAuth 콜백으로 세션을 발급하고 제공자 토큰은 암호화해 저장한다",
      async () => {
        assert.match(session.user.id, /^[0-9a-f-]{36}$/);
        const { rows } = await pool.query(
          "SELECT access_token FROM better_auth.accounts WHERE user_id=$1",
          [session.user.id],
        );
        assert.ok(
          rows[0].access_token && rows[0].access_token !== fixtureToken,
        );
        assert.equal(
          (await readKakaoStatus(pool, session)).sessionChecked,
          false,
        );
      },
    );
    await t.test(
      "로그인 후 서버 조회로만 전화번호 확인과 세션 확인 상태를 만든다",
      async () => {
        const result = await verifyCurrentKakaoSession(deps, headers());
        assert.equal(result.errorCode, null);
        assert.equal(result.sessionChecked, true);
        assert.equal(result.phoneMasked, "•••• 5678");
        assert.ok(!JSON.stringify(result).includes("+821012345678"));
      },
    );
    await t.test(
      "일반 수정 API의 보호 필드 입력을 거부하고 정상 이름 변경 후에도 번호가 유지된다",
      async () => {
        for (const field of [
          "phoneNumber",
          "phone_e164",
          "phoneNumberVerified",
          "status",
          "source",
          "checked_at",
          "app_id",
          "subject",
        ]) {
          const response = await handleAuthTestRequest(
            request("/update-user", "POST", { [field]: "forged" }),
            () => auth,
          );
          assert.equal(response.status, 400);
        }
        const valid = await handleAuthTestRequest(
          request("/update-user", "POST", { name: "Changed fixture" }),
          () => auth,
        );
        assert.equal(valid.status, 200);
        const { rows } = await pool.query(
          "SELECT phone_e164, status FROM better_auth.kakao_identities WHERE user_id=$1",
          [session.user.id],
        );
        assert.equal(rows[0].phone_e164, "+821012345678");
        assert.equal(rows[0].status, "confirmed");
      },
    );
    await t.test("토큰·프로필 HTTP API와 외부 Origin을 차단한다", async () => {
      for (const path of [
        "/get-access-token",
        "/refresh-token",
        "/account-info",
        "/get-session",
      ]) {
        const response = await handleAuthTestRequest(
          request(path, "POST", {}),
          () => auth,
        );
        assert.equal(response.status, 404);
      }
      const outside = request("/update-user", "POST", { name: "forged" });
      outside.headers.set("origin", "https://example.com");
      assert.equal(
        (await handleAuthTestRequest(outside, () => auth)).status,
        403,
      );
    });
    await t.test("새 로그인 세션은 전화번호를 다시 확인해야 한다", async () => {
      const second = await login();
      assert.notEqual(second.session.id, session.session.id);
      assert.equal(second.user.id, session.user.id);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM better_auth.users"))
          .rows[0].n,
        1,
      );
      assert.equal((await readKakaoStatus(pool, second)).sessionChecked, false);
      await verifyCurrentKakaoSession(deps, headers());
      assert.equal((await readKakaoStatus(pool, second)).sessionChecked, true);
      assert.equal((await readKakaoStatus(pool, session)).sessionChecked, true);
    });
    await t.test("번호 변경은 과거 세션의 확인 상태를 무효화한다", async () => {
      remoteProfile = {
        ...remoteProfile,
        kakao_account: {
          ...remoteProfile.kakao_account,
          phone_number: "+82 010-9876-5432",
        },
      };
      assert.equal(
        (await verifyCurrentKakaoSession(deps, headers())).phoneMasked,
        "•••• 5432",
      );
      assert.equal(
        (await readKakaoStatus(pool, session)).sessionChecked,
        false,
      );
    });
    await t.test(
      "동의 철회 응답은 저장된 번호와 모든 세션의 확인 상태를 비운다",
      async () => {
        remoteProfile = {
          ...remoteProfile,
          kakao_account: {
            ...remoteProfile.kakao_account,
            phone_number_needs_agreement: true,
          },
        };
        const result = await verifyCurrentKakaoSession(deps, headers());
        assert.equal(result.errorCode, "phone_consent_required");
        assert.equal(result.phoneMasked, null);
        assert.equal(result.sessionChecked, false);
        assert.equal(
          (await pool.query("SELECT * FROM better_auth.kakao_session_checks"))
            .rowCount,
          0,
        );
      },
    );
    await t.test(
      "카카오 조회 장애가 나면 기존 확인 상태를 재사용하지 않는다",
      async () => {
        remoteProfile.kakao_account.phone_number_needs_agreement = false;
        await verifyCurrentKakaoSession(deps, headers());
        const failingFetch: typeof fetch = async () =>
          new Response(null, { status: 503 });
        const result = await verifyCurrentKakaoSession(
          { ...deps, fetchProvider: failingFetch },
          headers(),
        );
        assert.equal(result.status, "pending");
        assert.equal(result.phoneMasked, null);
        assert.equal(result.sessionChecked, false);
      },
    );
    await t.test(
      "동시에 요청한 이전 응답이 최신 응답을 덮어쓰지 않는다",
      async () => {
        let unblock!: () => void;
        let started!: () => void;
        const began = new Promise<void>((resolve) => {
          started = resolve;
        });
        const blocked = new Promise<void>((resolve) => {
          unblock = resolve;
        });
        const slowFetch: typeof fetch = async (input, init) => {
          if (String(input).endsWith("/v2/user/me")) {
            const response = await fakeFetch(input, init);
            started();
            await blocked;
            return response;
          }
          return fakeFetch(input, init);
        };
        const older = verifyCurrentKakaoSession(
          { ...deps, fetchProvider: slowFetch },
          headers(),
        );
        await began;
        remoteProfile = {
          ...remoteProfile,
          kakao_account: {
            ...remoteProfile.kakao_account,
            phone_number: "+82 010-1234-5678",
          },
        };
        const newer = verifyCurrentKakaoSession(deps, headers());
        unblock();
        await Promise.all([older, newer]);
        assert.equal(
          (
            await pool.query(
              "SELECT phone_e164 FROM better_auth.kakao_identities",
            )
          ).rows[0].phone_e164,
          "+821012345678",
        );
      },
    );
    await t.test(
      "일반 DB 역할은 인증 스키마와 전화번호 표를 읽거나 쓸 수 없다",
      async () => {
        const role = `reader_${randomUUID().replaceAll("-", "")}`;
        await pool.query(`CREATE ROLE ${role} NOLOGIN`);
        const db = await pool.connect();
        try {
          await db.query(`SET ROLE ${role}`);
          await assert.rejects(
            () => db.query(`SELECT * FROM better_auth.kakao_identities`),
            { code: "42501" },
          );
          await assert.rejects(
            () =>
              db.query(
                `UPDATE better_auth.kakao_identities SET phone_e164='forged'`,
              ),
            { code: "42501" },
          );
        } finally {
          await db.query("RESET ROLE");
          db.release();
          await pool.query(`DROP ROLE ${role}`);
        }
      },
    );
    await t.test(
      "원격 조회 도중 로그아웃한 세션은 확인 상태를 저장하지 못한다",
      async () => {
        remoteProfile.kakao_account.phone_number_needs_agreement = false;
        const current = await auth.api.getSession({ headers: headers() });
        assert.ok(current);
        const deletingFetch: typeof fetch = async (input, init) => {
          await pool.query("DELETE FROM better_auth.sessions WHERE id=$1", [
            current.session.id,
          ]);
          return fakeFetch(input, init);
        };
        await assert.rejects(
          () =>
            verifyCurrentKakaoSession(
              { ...deps, fetchProvider: deletingFetch },
              headers(),
            ),
          /session_expired/,
        );
        assert.equal(
          (await readKakaoStatus(pool, current)).sessionChecked,
          false,
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await pool.end();
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    await admin.end();
  }
});
