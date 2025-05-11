"use client"

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { 
  Card, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IReversibleCardProps } from "./types";
import useReversibleCard from "./useReversibleCard";
import NumberBadge from "./NumberBadge";
import { ClassAttributes, HTMLAttributes } from "react";

const styles = {
  cardContainer: css`
    width: 100%;
    margin-top: 16px;
  `,
  cardContent: css`
    height: 60vh;
    overflow-y: auto;
    font-size: 1.1rem;

    & table {
      width: 100%;
    }

    & table tr.strong-under-line {
      border-bottom-width: 1.5px;
    }

    & table td {
      min-width: 4vw;
    }

    & table, & th, & td {
      border-width: 1px;
      border-color: var(--border);
      border-collapse: collapse;
    }

    & ol {
      list-style-type: decimal;
      padding-left: 1.5rem;
    }

    & ul {
      list-style-type: disc;
      padding-left: 1.5rem;
    }
  `,
  cardInfo: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
  `,
  badgeList: css`
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
  `,
  buttonContainer: css`
    display: flex;
    gap: 8px;
    justify-content: center;
  `
};

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
    <Card className="w-full mt-4 p-4">
      <CardContent className="h-[60vh] overflow-y-auto text-lg">
        {isFront ? (
          renderDisplayedQuestions
        ) : (
          <div dangerouslySetInnerHTML={{ __html: answer }} />
        )}
      </CardContent>

      <div className="flex justify-between items-center mt-2">
        <ul className="flex items-center h-6 select-none">
          {score && (
            <li className="flex items-center mr-2">
              AI <NumberBadge number={score} />점
            </li>
          )}
        </ul>
        <div>
          <p>
            {'⭐️'.repeat(priority)} {position + 1}/{questionsCount} Questions
          </p>
        </div>
      </div>

      <CardFooter className="flex gap-2 justify-center">
        <Button variant="outline" onClick={prev}>
          이전
        </Button>
        <Button variant="default" onClick={swap}>
          {swapLabel}
        </Button>
        <Button variant="outline" onClick={next}>
          다음
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ReversibleCard; 