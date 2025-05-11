export interface IQuestion {
  question: string;
  similarQuestions?: string[];
  answer: string;
  keywords?: string[];
  mainKeywords?: string[];
  audio?: {
    question?: string;
    answer?: string;
  };
  scores?: {
    chatgpt_4o?: number;
    claude_opus?: number;
  };
  priority?: number;
}

export interface IReversibleCardProps {
  questions: IQuestion[];
  shuffle?: boolean;
  subject?: string;
} 