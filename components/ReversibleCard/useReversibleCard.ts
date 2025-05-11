"use client"

import { useEffect, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { IQuestion } from './types';
import { IReversibleCardProps } from './types';

// AudioAutoPlay 관련 코드 제거
const useReversibleCard = ({ questions, shuffle }: IReversibleCardProps) => {
  const questionsCount = questions.length;

  const [cards, setCards] = useState<IQuestion[]>([]);
  const [position, setPosition] = useState(0);
  const [isFront, setIsFront] = useState(true);

  const card = cards[position];
  const hasSimilarQuestions = card?.similarQuestions && card.similarQuestions.length > 0;
  const displayedQuestions = [
    card?.question, 
    ...(hasSimilarQuestions && Array.isArray(card.similarQuestions) ? card.similarQuestions : [])
  ].filter(Boolean).sort(() => Math.random() - 0.5);
  
  const question = questions[position];
  const scores = {
    gpt4o: question?.scores?.chatgpt_4o,
    claudeOpus: question?.scores?.claude_opus,
  };
  const priority = question?.priority ?? 0;

  useEffect(() => {
    setCards(shuffle ? questions.slice().sort(() => Math.random() - 0.5) : questions.slice());
  }, [questions, shuffle]);

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
      scores,
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