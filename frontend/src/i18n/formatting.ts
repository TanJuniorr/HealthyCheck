import i18n from './index';
export const appLocale = () => i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
export function formatNumber(value: number | string | null | undefined, digits?: number): string {
 if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
 return new Intl.NumberFormat(appLocale(),digits === undefined ? { maximumFractionDigits:2 } : { minimumFractionDigits:digits,maximumFractionDigits:digits }).format(Number(value));
}
function dateValue(value: Date | string | number): Date {
 if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) { const [year,month,day] = value.split('-').map(Number); const date = new Date(0); date.setHours(0,0,0,0); date.setFullYear(year,month-1,day); return date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day ? date : new Date(NaN); }
 return value instanceof Date ? value : new Date(value);
}
export function formatDate(value: Date | string | number, options: Intl.DateTimeFormatOptions = { year:'numeric',month:'long',day:'numeric' }): string {
 const date = dateValue(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(appLocale(),options).format(date) : '—';
}
export function formatTime(value: Date | string | number, options: Intl.DateTimeFormatOptions = { hour:'2-digit',minute:'2-digit' }): string { return formatDate(value,options); }
export function formatDayLabel(value: string): string { return formatDate(value,{ day:'numeric',month:'numeric' }); }
export function formatDuration(value: number | null | undefined): string {
 if (value == null || !Number.isFinite(value)) return '—';
 const minutes = Math.round(value); return String(i18n.t('units.duration',{ hours:formatNumber(Math.floor(minutes/60)),minutes:formatNumber(minutes%60) }));
}
