export interface IQuestion {
  question: string;
  similarQuestions?: string[];
  answer: string;
  keywords?: string[];
  mainKeywords?: string[];
  score?: number;
  priority?: number;
}

export interface IReversibleCardProps {
  questions: IQuestion[];
  shuffle?: boolean;
  subject?: string;
} 