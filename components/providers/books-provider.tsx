'use client';
import { Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { booksAtom } from '@/atoms/books';
import { Book } from '@/domain/types';

type BooksProviderProps = {
  books: Book[];
  children: React.ReactNode;
};

function BooksHydration({ books, children }: BooksProviderProps) {
  useHydrateAtoms([[booksAtom, books]]);
  return children;
}

export function BooksProvider({ books, children }: BooksProviderProps) {
  return (
    <Provider>
      <BooksHydration books={books}>{children}</BooksHydration>
    </Provider>
  );
}
