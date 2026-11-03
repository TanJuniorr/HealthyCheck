import { useEffect, useState } from 'react';
import { toLocalDateKey } from '../lib/dateUtils';
/** Date-key rollover without navigation loops; only a changed date re-renders. */
export function useLocalToday(){const [today,setToday]=useState(toLocalDateKey);useEffect(()=>{const timer=setInterval(()=>setToday(toLocalDateKey()),30000);return()=>clearInterval(timer);},[]);return today;}
