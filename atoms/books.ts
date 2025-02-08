'use client';
import { Book } from '@/domain/types';
import { atom } from 'jotai';

export const booksAtom = atom<Book[]>([]);
