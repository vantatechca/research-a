export interface ScoringInputs {
  googleTrendsScore: number;
  redditScore: number;
  youtubeScore: number;
  competitorValidationScore: number;
  effortScore: number; // 0-100, lower = easier
  brainAlignmentScore: number;
  noveltyScore: number;
}

const WEIGHTS = {
  googleTrends: 0.2,
  reddit: 0.15,
  youtube: 0.1,
  competitorValidation: 0.2,
  effortInverse: 0.1,
  brainAlignment: 0.15,
  novelty: 0.1,
};

export function calculatePriorityScore(inputs: ScoringInputs): number {
  const score =
    WEIGHTS.googleTrends * inputs.googleTrendsScore +
    WEIGHTS.reddit * inputs.redditScore +
    WEIGHTS.youtube * inputs.youtubeScore +
    WEIGHTS.competitorValidation * inputs.competitorValidationScore +
    WEIGHTS.effortInverse * (100 - inputs.effortScore) +
    WEIGHTS.brainAlignment * inputs.brainAlignmentScore +
    WEIGHTS.novelty * inputs.noveltyScore;

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

export function effortToScore(effort: string): number {
  switch (effort.toLowerCase()) {
    case "low":
      return 20;
    case "medium":
      return 50;
    case "high":
      return 80;
    default:
      return 50;
  }
}
