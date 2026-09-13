import { KakaoVerificationError } from './auth/phone.ts';
import { readKakaoStatus, verifyCurrentKakaoSession } from './auth/kakao-verification.ts';
import { copyServiceResponse, isServiceRoute, readLimitedBody, serviceJson } from './http.ts';
import type { EdgeRuntime } from './runtime.ts';

type Options = { publicOrigin: string; functionName: string; version: string };

export function createServiceHandler(getRuntime: () => EdgeRuntime, options: Options) {
  return async (incoming: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    let stage = 'routing';
    try {
      const url = new URL(incoming.url);
      const prefixes = [`/functions/v1/${options.functionName}`, `/${options.functionName}`];
      const prefix = prefixes.find(value => url.pathname.startsWith(value + '/'));
      if (!prefix) return serviceJson({ error: 'not_found' }, 404);
      const path = url.pathname.slice(prefix.length);
      if (path === '/health' && incoming.method === 'GET') {
        stage = 'readiness';
        await getRuntime().ready();
        return serviceJson({ ready: true, version: options.version });
      }
      if (!isServiceRoute(path, incoming.method)) return serviceJson({ error: 'not_found' }, 404);
      const origin = incoming.headers.get('origin');
      if ((incoming.method === 'POST' && origin !== options.publicOrigin)
        || (origin !== null && origin !== options.publicOrigin)) return serviceJson({ error: 'invalid_origin' }, 403);
      // Only OAuth callback/error needs query parameters. Data endpoints accept typed path parameters.
      if (url.search && !['/api/auth/callback/kakao', '/api/auth/error'].includes(path)) return serviceJson({ error: 'invalid_query' }, 400);
      const body = incoming.method === 'POST' ? await readLimitedBody(incoming) : undefined;
      const headers = new Headers();
      for (const name of ['cookie', 'origin', 'content-type', 'user-agent']) {
        const value = incoming.headers.get(name);
        if (value) headers.set(name, value);
      }
      const request = new Request(options.publicOrigin + path + url.search, {
        method: incoming.method, headers, body,
      });
      stage = 'configuration';
      const runtime = getRuntime();
      stage = 'request_limit';
      // Shared database budgets survive cold starts and do not trust forwarded IP headers.
      if (!await runtime.limit(path === '/api/auth/sign-in/social' ? 'login' : 'service', path === '/api/auth/sign-in/social' ? 60 : 600)) {
        const response = serviceJson({ error: 'rate_limited' }, 429);
        response.headers.set('Retry-After', '60');
        return response;
      }
      if (path.startsWith('/api/auth/')) {
        stage = 'authentication';
        if (path === '/api/auth/update-user' || path === '/api/auth/sign-in/social') {
          let input: Record<string, unknown>;
          try {
            const parsed = await request.clone().json();
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
            input = parsed;
          } catch { return serviceJson({ error: 'invalid_body' }, 400); }
          if (path.endsWith('/update-user') && Object.keys(input).some(key => !['name', 'image'].includes(key))) return serviceJson({ error: 'protected_fields' }, 400);
          if (path.endsWith('/sign-in/social')) {
            if (input.provider !== 'kakao') return serviceJson({ error: 'provider_not_allowed' }, 400);
            const allowed = ['provider', 'callbackURL', 'errorCallbackURL', 'newUserCallbackURL', 'disableRedirect'];
            if (Object.keys(input).some(key => !allowed.includes(key))) return serviceJson({ error: 'invalid_body' }, 400);
            for (const key of ['callbackURL', 'newUserCallbackURL', 'errorCallbackURL']) {
              if (input[key] === undefined) continue;
              if (typeof input[key] !== 'string') return serviceJson({ error: 'invalid_callback' }, 400);
              let target: URL;
              try { target = new URL(input[key], options.publicOrigin); }
              catch { return serviceJson({ error: 'invalid_callback' }, 400); }
              if (target.origin !== options.publicOrigin || target.username || target.password
                || (key === 'errorCallbackURL' ? target.pathname !== '/sign-in' : target.pathname !== '/auth/complete')) {
                return serviceJson({ error: 'invalid_callback' }, 400);
              }
            }
          }
        }
        return copyServiceResponse(await runtime.auth.handler(request));
      }
      stage = 'session';
      const session = await runtime.auth.api.getSession({ headers: request.headers });
      if (!session) return path === '/api/service/access'
        ? serviceJson({ state: 'anonymous' }) : serviceJson({ error: 'session_expired' }, 401);
      if (path === '/api/kakao/verify') {
        if (body?.length) return serviceJson({ errorCode: 'body_not_allowed' }, 400);
        if (!await runtime.limit('phone:' + session.user.id, 10)) return serviceJson({ errorCode: 'rate_limited' }, 429);
        stage = 'phone_verification';
        const result = await verifyCurrentKakaoSession(runtime, request.headers);
        return serviceJson({ sessionChecked: result.sessionChecked, errorCode: result.errorCode }, result.errorCode ? 422 : 200);
      }
      stage = 'phone_status';
      const phone = await readKakaoStatus(runtime.pool, session);
      const user = { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null };
      if (!phone.sessionChecked) return path === '/api/service/access'
        ? serviceJson({ state: 'phone_pending', user }) : serviceJson({ error: 'phone_required' }, 403);
      stage = 'ticket';
      const data = await runtime.data(session);
      const ticket = await data.rpc('has_active_ticket');
      if (ticket.error || typeof ticket.data !== 'boolean') throw new Error('TICKET_UNAVAILABLE');
      if (path === '/api/service/access') return serviceJson({ state: ticket.data ? 'active' : 'no_ticket', user });
      if (!ticket.data) return serviceJson({ error: 'ticket_required' }, 403);
      stage = 'learning_data';
      if (path === '/api/service/books') {
        const [books, chapters] = await Promise.all([
          data.from('books').select('*').order('id', { ascending: false }),
          data.from('chapters').select('*').order('sort_order', { ascending: true }),
        ]);
        if (books.error || chapters.error) throw new Error('DATA_UNAVAILABLE');
        return serviceJson({ books: books.data, chapters: chapters.data });
      }
      const match = path.match(/^\/api\/service\/books\/([1-9]\d*)\/chapters\/([1-9]\d*)$/)!;
      const bookId = Number(match[1]), chapterId = Number(match[2]);
      if (!Number.isSafeInteger(bookId) || !Number.isSafeInteger(chapterId)) return serviceJson({ error: 'invalid_id' }, 400);
      const chapter = await data.from('chapters').select('*').eq('id', chapterId).eq('book_id', bookId).maybeSingle();
      if (chapter.error) throw new Error('DATA_UNAVAILABLE');
      if (!chapter.data) return serviceJson({ error: 'not_found' }, 404);
      const questions = await data.from('questions').select('*').eq('chapter_id', chapterId)
        .order('sort_order', { ascending: true }).order('id', { ascending: true });
      if (questions.error) throw new Error('DATA_UNAVAILABLE');
      return serviceJson({ chapter: chapter.data, questions: questions.data });
    } catch (error) {
      if (error instanceof KakaoVerificationError) return serviceJson({ errorCode: error.code }, error.code === 'session_expired' ? 401 : 422);
      if (error instanceof Error && error.message === 'BODY_TOO_LARGE') return serviceJson({ error: 'body_too_large' }, 413);
      // Never log the thrown error: database/OAuth errors can contain credentials or personal data.
      const known = ['EDGE_SIGNING_KEY_INVALID', 'EDGE_CONFIG_MISSING', 'EDGE_CONFIG_INVALID', 'EDGE_DB_CONFIG_INVALID',
        'EDGE_PUBLIC_KEY_INVALID', 'TICKET_UNAVAILABLE', 'DATA_UNAVAILABLE'];
      const code = error instanceof Error && known.includes(error.message) ? error.message : 'DEPENDENCY_UNAVAILABLE';
      console.error(JSON.stringify({ event: 'service_unavailable', stage, code, requestId, version: options.version }));
      return serviceJson({ error: 'service_unavailable', requestId }, 503);
    }
  };
}
