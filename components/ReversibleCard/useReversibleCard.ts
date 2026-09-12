'use client';

import { useMemo, useState } from 'react';
import { shuffleArray } from '@/lib/shuffle';
import { type IQuestion, type IReversibleCardProps } from './types';

const arrangeCards = (questions: IQuestion[], shuffle?: boolean) =>
  shuffle ? shuffleArray(questions) : questions.slice();

// AudioAutoPlay 관련 코드 제거
const useReversibleCard = ({ questions, shuffle }: IReversibleCardProps) => {
  const questionsCount = questions.length;

  const [cards, setCards] = useState<IQuestion[]>(() => arrangeCards(questions, shuffle));
  const [position, setPosition] = useState(0);
  const [isFront, setIsFront] = useState(true);

  // questions나 shuffle이 바뀌면 렌더 중에 카드를 다시 배열한다.
  // useEffect 안에서 setState를 부르던 자리를 React가 권하는 방식으로 바꾼 것이다.
  const [prevInputs, setPrevInputs] = useState({ questions, shuffle });
  if (prevInputs.questions !== questions || prevInputs.shuffle !== shuffle) {
    setPrevInputs({ questions, shuffle });
    setCards(arrangeCards(questions, shuffle));
  }

  const card = cards[position];
  // 카드가 바뀔 때만 순서를 섞는다. 예전에는 렌더마다 섞여서 뒤집을 때마다 순서가 바뀌었다.
  const displayedQuestions = useMemo(() => {
    const similar = Array.isArray(card?.similarQuestions) ? card.similarQuestions : [];
    return shuffleArray([card?.question, ...similar].filter(Boolean));
  }, [card]);

  const question = questions[position];
  const score = question?.score;
  const priority = question?.priority ?? 0;

  const prev = () => {
    setPosition((position) => (position - 1 >= 0 ? position - 1 : questionsCount - 1));
    setIsFront(true);
  };

  const next = () => {
    setPosition((position) => (position + 1) % questionsCount);
    setIsFront(true);
  };

  const swapLabel = isFront ? '정답 보기' : '질문 보기';
  const swap = () => {
    setIsFront(!isFront);
  };

  return {
    getter: {
      answer: card?.answer || '',
      displayedQuestions,
      isFront,
      swapLabel,
      position,
      question,
      questionsCount,
      score,
      priority,
    },
    methods: {
      prev,
      next,
      swap,
    },
  };
};

export default useReversibleCard;
