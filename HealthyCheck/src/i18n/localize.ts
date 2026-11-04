import i18n, { en,vi } from './index';
import { formatDate,formatDuration,formatNumber,formatTime } from './formatting';
function leaves(value: unknown,prefix=''): [string,string][] {
 if (typeof value === 'string') return [[prefix,value]];
 if (!value || typeof value !== 'object') return [];
 return Object.entries(value).flatMap(([key,child]) => leaves(child,prefix ? `${prefix}.${key}` : key));
}
// Only application-controlled feedback is passed here. Never process names, notes or DB text.
const messageKeys = new Map([...leaves(en),...leaves(vi)].filter(([key]) => /^(errors|validation|auth|profile)\./.test(key)).map(([key,value]) => [value,key]));
export function localizeMessage(message: string | null | undefined): string {
 if (!message) return '';
 if (i18n.exists(message)) return String(i18n.t(message));
 const key = messageKeys.get(message);
 if (key) return String(i18n.t(key));
 if (message.startsWith('Trường dữ liệu không được phép: ')) return String(i18n.t('validation.forbiddenField'));
 if (message.startsWith('Thiếu trường ')) { const field = message.substring('Thiếu trường '.length); return String(i18n.t('validation.missingField',{ field:i18n.t(i18n.exists(`fields.${field}`) ? `fields.${field}` : 'fields.required') })); }
 return String(i18n.t('errors.general'));
}
const protectedFields = new Set(['id','categoryId','route','icon','color','bgColor','author','email','avatarInitials']);
function localizeStaticString(value: string,field?: string): string {
 if (i18n.exists(value)) return String(i18n.t(value));
 const readTime = /^(\d+) min read$/.exec(value);
 if (readTime) return String(i18n.t('articles.readTime',{ count:Number(readTime[1]) }));
 const duration = /^(\d+)h(?: (\d+)m)?$/.exec(value);
 if (duration) return formatDuration(Number(duration[1])*60+Number(duration[2] ?? 0));
 const time = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
 if (time) { const date = new Date(2026,0,1,(Number(time[1])%12)+(time[3]==='PM'?12:0),Number(time[2])); return formatTime(date); }
 if (field === 'date') { const date = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+), (\d{4})$/.exec(value); if (date) return formatDate(new Date(Number(date[3]),['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(date[1]),Number(date[2]))); }
 const quantity = /^([\d,]+(?:\.\d+)?)\s*(kcal|kg|cm|ml|L|bpm)?$/.exec(value);
 if (quantity) return formatNumber(Number(quantity[1].replaceAll(',',''))) + (quantity[2] ? ` ${quantity[2]}` : '');
 return value;
}
// This helper is exclusively for bundled, authored data. Live Supabase/user data is never passed to it.
export function localizeStaticData<T>(value: T): T {
 function visit(item: unknown,field?: string): unknown {
  if (typeof item === 'string') return localizeStaticString(item,field);
  if (Array.isArray(item)) return item.map(child => visit(child,field));
  if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key,child]) => [key,protectedFields.has(key) ? child : visit(child,key)]));
  return item;
 }
 return visit(value) as T;
}
