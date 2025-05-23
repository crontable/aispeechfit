'use client';

import { ConditionalSidebarToggle } from '@/components/conditional-sidebar-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { booksAtom } from '@/atoms/books';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function StudyPage() {
  const books = useAtomValue(booksAtom);

  return (
    <div className="flex-1 w-full flex flex-col">
      {/* 헤더 */}
      <div className="flex justify-between items-center h-[60px] border-b">
        <div className="flex items-center gap-3">
          <ConditionalSidebarToggle />
          <div>
            <h1 className='text-2xl font-bold'>구술 공부</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 p-6">
        {books.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">학습 자료가 없습니다</h2>
              <p className="text-muted-foreground mb-4">
                아직 등록된 교재가 없습니다. 관리자에게 문의하여 학습 자료를 추가해달라고 요청하세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 추가 안내 */}
            <Card className="border-dashed">
              <CardContent className="p-8">
                <div className="text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <h3 className="font-semibold mb-1">학습을 시작하세요</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    원하는 교재를 선택하고 챕터별로 학습을 진행할 수 있습니다.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 팁: 왼쪽 사이드바에서도 빠르게 챕터에 접근할 수 있습니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 교재 목록 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {books.map((book) => (
                <Card key={book.id} className="hover:shadow-lg transition-all duration-200">
                  <CardHeader className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{book.title}</CardTitle>
                      </div>
                      <Badge variant="outline">
                        {book.chapters?.length || 0}개 챕터
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-3">
                    {book.chapters && book.chapters.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {book.chapters.map((chapter) => (
                          <Button
                            key={chapter.id}
                            variant="ghost"
                            className="justify-start h-auto py-3 px-4 text-left"
                            asChild
                          >
                            <Link href={`/study/books/${book.id}/chapters/${chapter.id}`}>
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{chapter.title}</span>
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  시작하기
                                </Badge>
                              </div>
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">이 교재에는 아직 챕터가 없습니다.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            
          </div>
        )}
      </div>
    </div>
  );
}
