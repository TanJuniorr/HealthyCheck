import type { DashboardSummary } from '../types/health';

export const HEALTH_SCORE_MINIMUM_METRICS = 2;
export const HEALTH_SCORE_LOW_THRESHOLD = 40;
export const HEALTH_SCORE_LOW_NOTIFICATION_MINIMUM_METRICS = 3;

export type HealthScoreMetricKey = 'steps' | 'sleep' | 'water' | 'nutrition';
export type HealthScoreMetric = { key: HealthScoreMetricKey; points: number; maximum: number };
export type HealthScoreResult = {
  score: number | null;
  availableMetricCount: number;
  totalMetricCount: 4;
  metrics: HealthScoreMetric[];
};

type Candidate = {
  key: HealthScoreMetricKey;
  maximum: number;
  recorded: boolean;
  current: number | null;
  goal: number | null;
};

const weights: Record<HealthScoreMetricKey, number> = {
  steps: 30,
  sleep: 30,
  water: 20,
  nutrition: 20,
};

function targetProgress(current: number | null, goal: number | null) {
  if (current === null || goal === null || !Number.isFinite(current) || !Number.isFinite(goal) || goal <= 0) return null;
  return Math.min(1, Math.max(0, current / goal));
}

export function calculateHealthScore(summary: DashboardSummary | null | undefined): HealthScoreResult {
  const empty: HealthScoreResult = { score: null, availableMetricCount: 0, totalMetricCount: 4, metrics: [] };
  if (!summary) return empty;

  const candidates: Candidate[] = [
    { key: 'steps', maximum: weights.steps, recorded: summary.steps.hasRecords, current: summary.steps.total, goal: summary.steps.goal },
    { key: 'sleep', maximum: weights.sleep, recorded: summary.sleep.minutes !== null, current: summary.sleep.minutes, goal: summary.sleep.goalMinutes },
    { key: 'water', maximum: weights.water, recorded: summary.water.hasRecords, current: summary.water.totalMl, goal: summary.water.goalMl },
    { key: 'nutrition', maximum: weights.nutrition, recorded: summary.nutrition.hasRecords, current: summary.nutrition.calories, goal: summary.nutrition.calorieGoal },
  ];

  const metrics: HealthScoreMetric[] = candidates.flatMap(candidate => {
    if (!candidate.recorded) return [];
    const progress = targetProgress(candidate.current, candidate.goal);
    if (progress === null) return [];
    return [{ key: candidate.key, points: progress * candidate.maximum, maximum: candidate.maximum }];
  });

  if (metrics.length < HEALTH_SCORE_MINIMUM_METRICS) {
    return { score: null, availableMetricCount: metrics.length, totalMetricCount: 4, metrics };
  }

  const possiblePoints = metrics.reduce((sum, metric) => sum + metric.maximum, 0);
  const earnedPoints = metrics.reduce((sum, metric) => sum + metric.points, 0);
  const score = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : null;
  return { score, availableMetricCount: metrics.length, totalMetricCount: 4, metrics };
}
