import { invalid } from './dataErrors';
export type DateInput = Date | string;
export function parseLocalDate(value: DateInput): Date {
  if (value instanceof Date) { if (!Number.isFinite(value.getTime())) invalid('Ngày không hợp lệ.'); return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return invalid('Ngày phải có định dạng YYYY-MM-DD.');
  const [year, month, day] = match.slice(1).map(Number);
  const result = new Date(0); result.setHours(0,0,0,0); result.setFullYear(year,month - 1,day);
  if (year < 1 || result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) invalid('Ngày không hợp lệ.');
  return result;
}
export function toLocalDateKey(value: DateInput = new Date()): string {
  const date = parseLocalDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return invalid('Thời gian phải là ISO 8601 có múi giờ.');
  parseLocalDate(value.substring(0, 10));
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || Number(value.substring(11, 13)) > 23 || Number(value.substring(14, 16)) > 59 || Number(value.substring(17, 19) || 0) > 59) return invalid('Thời gian không hợp lệ.');
  return new Date(milliseconds).toISOString();
}
export function timestampDateKey(value: string) { return toLocalDateKey(new Date(timestamp(value))); }
export function shiftDay(value: DateInput, offset: number): string { const date = parseLocalDate(value); date.setDate(date.getDate() + offset); return toLocalDateKey(date); }
export function getLocalDayBounds(value: DateInput) { const start = parseLocalDate(value); const end = new Date(start); end.setDate(end.getDate() + 1); return { start: start.toISOString(), end: end.toISOString() }; }
export function validateDateRange(startDate: DateInput, endDate: DateInput) {
  const start = toLocalDateKey(startDate); const end = toLocalDateKey(endDate);
  if (start > end) invalid('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
  return { start, end };
}
export function getWeekRange(value: DateInput = new Date()) { const date = parseLocalDate(value); const offset = (date.getDay() + 6) % 7; const start = shiftDay(date, -offset); return { start, end: shiftDay(start, 6) }; }
export function getMonthRange(value: DateInput = new Date()) { const date = parseLocalDate(value); return { start: toLocalDateKey(new Date(date.getFullYear(), date.getMonth(), 1)), end: toLocalDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)) }; }
export function getDaysInRange(startDate: DateInput, endDate: DateInput): string[] {
  const { start, end } = validateDateRange(startDate, endDate); const days: string[] = [];
  for (let day = start; day <= end; day = shiftDay(day, 1)) { if (days.length >= 3660) invalid('Khoảng ngày tối đa 3660 ngày.'); days.push(day); }
  return days;
}
