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
  /** ids from results.json of the named results this lesson names or states (not rendered). */
  results: string[];
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

export type ChapterCheckpoint = {
  id: string;
  cluster: string;
  title: string;
  problems: {
    id: string;
    lessonIds: string[];
    prompt: string;
    hints: string[];
    answer: string;
  }[];
};

export type DistributionReference = {
  name: string;
  lessonId: string;
  support: string;
  parameters: string;
  formula: string;
  mean: string;
  variance: string;
  caution: string;
};
