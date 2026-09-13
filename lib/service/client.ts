import 'server-only';
import { headers } from 'next/headers';
import { getServiceConfig } from './config.ts';
import { serviceCookie } from './transport.ts';
import type { BookDTO, ChapterDTO, QuestionDTO } from '@/domain/types';

export type ServiceUser = { id: string; name: string; email: string; image: string | null };
export type ServiceAccess = { state: 'anonymous' } | { state: 'phone_pending' | 'active' | 'no_ticket'; user: ServiceUser };
export class ServiceError extends Error {
  status: number;
  constructor(status: number) { super('Service request failed'); this.status = status; }
}

async function requestService<T>(path: string): Promise<T> {
  const config = getServiceConfig();
  let response: Response;
  try {
    response = await fetch(config.functionUrl + path, {
      headers: { cookie: serviceCookie(await headers()) },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
    });
  } catch { throw new ServiceError(503); }
  if (!response.ok) throw new ServiceError(response.status);
  try { return await response.json() as T; }
  catch { throw new ServiceError(503); }
}

export async function readServiceAccess() {
  const result = await requestService<ServiceAccess>('/api/service/access');
  if (!result || !['anonymous', 'phone_pending', 'active', 'no_ticket'].includes(result.state)
    || (result.state !== 'anonymous' && (!result.user || typeof result.user.email !== 'string'))) throw new ServiceError(503);
  return result;
}

export const readServiceBooks = () => requestService<{ books: BookDTO[]; chapters: ChapterDTO[] }>('/api/service/books');
export function readServiceChapter(bookId: string, chapterId: string) {
  if (![bookId, chapterId].every(value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)))) throw new ServiceError(404);
  return requestService<{ chapter: ChapterDTO; questions: QuestionDTO[] }>(`/api/service/books/${bookId}/chapters/${chapterId}`);
}
