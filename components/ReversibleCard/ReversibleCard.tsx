"use client";

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IReversibleCardProps } from "./types";
import useReversibleCard from "./useReversibleCard";
import NumberBadge from "./NumberBadge";
import { ClassAttributes, HTMLAttributes } from "react";

const StyledCard = styled(Card)`
  width: 100%;
  margin-top: 16px;
`;

const StyledCardContent = styled(CardContent)`
  height: 60vh;
  overflow-y: auto;
  font-size: 1.1rem;

  
  /* 테이블 추가 스타일 */
  table {
    width: 100%;
  }

  table tr.strong-under-line {
    border-bottom-width: 1.5px;
  }

  table td {
    min-width: 4vw;
  }

  table, 
  th, 
  td {
    border-width: 1px;
    border-collapse: collapse;
  }

  /* 테마별 테이블 경계선 색상 */
  html.light & table,
  html.light & th,
  html.light & td {
    border-color: oklch(60% 0.01 0); /* 연한 회색 (라이트 테마) */
  }
  
  html.dark & table,
  html.dark & th,
  html.dark & td {
    border-color: oklch(70% 0.01 0); /* 어두운 회색 (다크 테마) */
  }

  ol,
  ul {
    list-style-type: disc;
  }

  ol {
    list-style-type: decimal;
    padding-left: 1.5rem;
  }

  ul {
    list-style-type: disc;
    padding-left: 1.5rem;
  }
  
  strong.keyword {
    color: var(--keyword-color);
    font-weight: 600;
  }

  /* 대체 선택자 - html 태그에 클래스가 적용된 경우 */
  html.light & strong.keyword {
    color: oklch(54.6% 0.245 262.881);
  }
  
  html.dark & strong.keyword {
    color: oklch(87.9% 0.169 91.605);
  }
`;

const CardInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
`;

const BadgeList = styled.ul`
  display: flex;
  align-items: center;
  height: 24px;
  user-select: none;

  & > li {
    display: flex;
    align-items: center;
    &:not(:last-child) {
      margin-right: 8px;
    }
  }
`;

const StyledCardFooter = styled(CardFooter)`
  display: flex;
  gap: 8px;
  justify-content: center;
`;

function ReversibleCard({ questions, shuffle }: IReversibleCardProps) {
  const {
    getter: {
      answer,
      displayedQuestions,
      isFront,
      position,
      swapLabel,
      questionsCount,
      score,
      priority,
    },
    methods: { prev, next, swap },
  } = useReversibleCard({ questions, shuffle });

  const renderDisplayedQuestions = (
    <ul>
      {displayedQuestions.map((question, index) => (
        <li key={index}>{question}</li>
      ))}
    </ul>
  );

  return (
    <StyledCard className="p-4">
      <StyledCardContent className="text-lg">
        {isFront ? (
          renderDisplayedQuestions
        ) : (
          <div dangerouslySetInnerHTML={{ __html: answer }} />
        )}
      </StyledCardContent>

      <CardInfo>
        <BadgeList>
            {!isFront && (
              <li className="flex items-center mr-2">
                AI 예측 {score ? <><NumberBadge number={score} />점</>: '예측 준비 중...' }
              </li>
            )}
        </BadgeList>
        <div>
          <p>
            {"⭐️".repeat(priority)} {position + 1}/{questionsCount} Questions
          </p>
        </div>
      </CardInfo>

      <StyledCardFooter>
        <Button variant="outline" onClick={prev}>
          이전
        </Button>
        <Button variant="default" onClick={swap}>
          {swapLabel}
        </Button>
        <Button variant="outline" onClick={next}>
          다음
        </Button>
      </StyledCardFooter>
    </StyledCard>
  );
}

export default ReversibleCard;
