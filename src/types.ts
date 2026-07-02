export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  date?: string;
  detectedAt?: number;
}

export interface WatchedQuestion {
  id: string;
  text: string;
  keywords: string[];
  addedAt: number;
  matched: boolean;
  matchedEntry?: QAEntry;
}
