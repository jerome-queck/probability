export type LabId =
  | 'birthday'
  | 'bayes'
  | 'binomial-poisson'
  | 'normal-approximation'
  | 'law-of-large-numbers'
  | 'central-limit';

export type Lesson = {
  id: string;
  title: string;
  cluster: string;
  question: string;
  prerequisites: string[];
  summary: string;
  intuition: string;
  definition: string[];
  theorem: string;
  hypotheses: string[];
  proof: string[];
  example: { prompt: string; steps: string[]; conclusion: string };
  practice: { prompt: string; hints: string[]; answer: string };
  caution: string;
  bridge?: string;
  reference: string;
  lab?: LabId;
};
