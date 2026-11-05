import type { HealthGoalRow, ProfileRow, SleepRecordRow, StepRecordRow, WaterRecordRow, WeightRecordRow } from './database';
import type { MealWithFood, Nutrition } from './health';

export type ReportRange = { start: string; end: string };
export type ReportSource = {
  owner: string;
  profile: ProfileRow | null;
  steps: StepRecordRow[];
  sleep: SleepRecordRow[];
  water: WaterRecordRow[];
  meals: MealWithFood[];
  weights: WeightRecordRow[];
  latestWeight: WeightRecordRow | null;
  goals: HealthGoalRow[];
};
export type ReportDay = { date: string; value: number | null; goal: number | null };
export type ReportMetric = {
  daily: ReportDay[];
  total: number | null;
  average: number | null;
  recordedDays: number;
  eligibleDays: number;
  achievedDays: number;
  best: ReportDay | null;
  least: ReportDay | null;
};
export type HealthReport = ReportRange & {
  owner: string;
  generatedAt: string;
  timeZone: string;
  profile: ProfileRow | null;
  dayCount: number;
  daysWithData: number;
  steps: ReportMetric;
  sleep: ReportMetric & { quality: number | null };
  water: ReportMetric;
  nutrition: ReportMetric & { macros: Nutrition | null };
  weight: {
    latest: WeightRecordRow | null;
    points: { date: string; timestamp: string; value: number }[];
    change: number | null;
    bmi: number | null;
  };
  goals: { eligibleDays: number; achievedDays: number };
};
export type ReportPdf = { owner: string; uri: string; filename: string; canPreview: boolean; canShare: boolean; html?: string };
