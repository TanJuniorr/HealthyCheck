import type { SleepScheduleInput, SleepRecordRow } from '../types/database';
import { invalid } from './dataErrors';
export function clockMinutes(value: string) {
 if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value)) return invalid('schedule.invalid');
 return Number(value.slice(0,2))*60+Number(value.slice(3,5));
}
export function plannedDuration(schedule: Pick<SleepScheduleInput,'bedtime'|'wake_time'>) { return (clockMinutes(schedule.wake_time)-clockMinutes(schedule.bedtime)+1440)%1440; }
export function validateSchedule(input: SleepScheduleInput): SleepScheduleInput {
 if (!input || Object.keys(input).some(k=>!['bedtime','wake_time','active_days','reminder_enabled','reminder_minutes_before'].includes(k))) return invalid('schedule.invalid');
 if (!plannedDuration(input) || !Array.isArray(input.active_days) || !input.active_days.length || new Set(input.active_days).size!==input.active_days.length || input.active_days.some(d=>!Number.isInteger(d)||d<1||d>7) || typeof input.reminder_enabled!=='boolean' || ![5,10,15,30,60].includes(input.reminder_minutes_before)) return invalid('schedule.invalid');
 return {...input,active_days:[...input.active_days].sort()};
}
export function reminderTriggers(schedule: SleepScheduleInput) {
 const minutes=clockMinutes(schedule.bedtime)-schedule.reminder_minutes_before;
 return schedule.active_days.map(day=>({weekday:((day+(minutes<0?-1:0))%7)+1,hour:Math.floor(((minutes+1440)%1440)/60),minute:(minutes+1440)%60}));
}
export function clockDifference(actual: number, planned: number) { return ((actual-planned+2160)%1440)-720; }
export function compareSchedule(record: SleepRecordRow,schedule: SleepScheduleInput) {
 const start=new Date(record.sleep_start),end=new Date(record.sleep_end);
 const bed=clockMinutes(schedule.bedtime),wake=clockMinutes(schedule.wake_time);
 const candidates=[-1,0,1].map(offset=>{const date=new Date(start);date.setDate(date.getDate()+offset);date.setHours(Math.floor(bed/60),bed%60,0,0);return date;});
 const plannedStart=candidates.sort((a,b)=>Math.abs(a.getTime()-start.getTime())-Math.abs(b.getTime()-start.getTime()))[0];
 if(!schedule.active_days.includes((plannedStart.getDay()+6)%7+1)) return null;
 const plannedEnd=new Date(plannedStart);if(wake<=bed)plannedEnd.setDate(plannedEnd.getDate()+1);plannedEnd.setHours(Math.floor(wake/60),wake%60,0,0);
 return {bedtime:(start.getTime()-plannedStart.getTime())/60000,wake:(end.getTime()-plannedEnd.getTime())/60000,planned:(plannedEnd.getTime()-plannedStart.getTime())/60000,plannedStart,plannedEnd};
}
