import { makeRepository } from './queryCore';
import { getGoalsForRange } from './healthGoalsService';
import { aggregateSteps, goalProgress, selectCurrentGoals } from '../lib/healthCalculations';
import { getWeekRange, getMonthRange, toLocalDateKey, validateDateRange, type DateInput } from '../lib/dateUtils';
const repo = makeRepository('step_records');
export const getStepsHistory = repo.history;
export const getStepRecordById = repo.byId;
export const addStepRecord = repo.add;
export const updateStepRecord = repo.update;
export const deleteStepRecord = repo.remove;
export const getStepsByDateRange = repo.range;
export function getStepsByDate(date: DateInput) { const key = toLocalDateKey(date); return repo.range(key,key); }
export async function getStepsSummary(start: string,end: string) {
 validateDateRange(start,end);
 const [rows,goals] = await Promise.all([repo.range(start,end),getGoalsForRange(start,end)]);
 const summary = aggregateSteps(rows,start,end);
 summary.daily = summary.daily.map(day => { const goal = selectCurrentGoals(goals,day.date)?.daily_steps ?? null; return { ...day,goal,progressPercent:goalProgress(day.totalSteps,goal) }; });
 if (summary.bestDay) summary.bestDay = summary.daily.find(day => day.date === summary.bestDay?.date) ?? null;
 return summary;
}
export function getWeeklySteps(date: DateInput = new Date()) { const range = getWeekRange(date); return getStepsSummary(range.start,range.end); }
export function getMonthlySteps(date: DateInput = new Date()) { const range = getMonthRange(date); return getStepsSummary(range.start,range.end); }
