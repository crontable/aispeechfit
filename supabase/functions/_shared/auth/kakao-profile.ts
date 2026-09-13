function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

// Kakao documents these property groups for basic email/profile information.
// https://developers.kakao.com/docs/ko/kakaologin/rest-api#req-user-info
async function getUserInfo(tokens: { accessToken?: string }) {
  if (!tokens.accessToken) return null;
  const url = new URL('https://kapi.kakao.com/v2/user/me');
  url.searchParams.set('property_keys', JSON.stringify(['kakao_account.email', 'kakao_account.profile']));
  try {
    const response = await fetch(url.href, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const raw = object(await response.json());
    if (typeof raw.id !== 'number' || !Number.isSafeInteger(raw.id) || raw.id <= 0) return null;
    const account = object(raw.kakao_account), profile = object(account.profile);
    const email = typeof account.email === 'string' ? account.email : undefined;
    const nickname = typeof profile.nickname === 'string' ? profile.nickname : '';
    const image = typeof profile.profile_image_url === 'string' ? profile.profile_image_url
      : typeof profile.thumbnail_image_url === 'string' ? profile.thumbnail_image_url : undefined;
    const emailValid = account.is_email_valid === true, emailVerified = account.is_email_verified === true;
    // Return only fields used by authentication, even if the provider sends extras.
    return {
      user: { name: nickname, email: email ?? null, image, emailVerified: emailValid && emailVerified },
      data: { id: raw.id, kakao_account: { email, is_email_valid: emailValid,
        is_email_verified: emailVerified, profile: { nickname, profile_image_url: image } } },
    };
  } catch { return null; }
}

export const kakaoLoginOptions = {
  disableDefaultScope: true,
  scope: ['account_email', 'profile_nickname'],
  getUserInfo,
};
