import { DataAccessError } from './dataErrors';
import { parseLocalDate } from './dateUtils';
export const MAX_WATER_ML = 5000;
export function waterAmount(value: string | number) {
 if ((typeof value==='string' && !/^\d+$/.test(value.trim())) || !Number.isSafeInteger(Number(value)) || Number(value)<1 || Number(value)>MAX_WATER_ML) throw new DataAccessError('INVALID_INPUT','water.invalidAmount');
 return Number(value);
}
export function waterTimestamp(date: string,time: string) {
 try {
  const local=parseLocalDate(date),match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if(!match) throw Error();
  const hour=Number(match[1]),minute=Number(match[2]);local.setHours(hour,minute,0,0);
  if(local.getHours()!==hour||local.getMinutes()!==minute)throw Error();
  if(local.getTime()>Date.now())throw new DataAccessError('INVALID_INPUT','water.futureTime');
  return local.toISOString();
 } catch(error) {if(error instanceof DataAccessError&&error.message==='water.futureTime')throw error;throw new DataAccessError('INVALID_INPUT','water.invalidTime');}
}
