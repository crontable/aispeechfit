// This only avoids initializing auth for anonymous requests; it never authenticates a cookie.
export function hasSessionCookie(headers: Headers) {
  return (headers.get('cookie') ?? '').split(';').some(part => {
    const [name, ...value] = part.trim().split('=');
    return ['aispeechfit-better-auth.session_token', '__Secure-aispeechfit-better-auth.session_token'].includes(name)
      && value.join('=').length > 0;
  });
}
