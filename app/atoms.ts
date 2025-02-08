import { BookDTO } from '@/domain/types';
import { atom } from 'jotai';

export const myBooks = atom<BookDTO[]>([]);
