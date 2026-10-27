import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { assertIdentity } from '../services/queryCore';
import { dataError } from '../lib/dataErrors';
import { dependsOnSleep, subscribeSleepChanges } from '../lib/healthQueryEvents';
export type QueryState<T> = { data: T | null; isLoading: boolean; error: string | null; refresh: () => Promise<void> };
// No global cache or auth listener; state is bound to the existing AuthProvider user.
export function useHealthQuery<T>(loader: () => Promise<T>, key: string): QueryState<T> {
 const { user } = useAuth(); const owner = user?.id ?? null;
 const loaderRef = useRef(loader);
 // Assigned in the lifecycle callback, never used to authorize database access.
 const generation = useRef(0);
 const [state,setState] = useState<{ owner: string | null; key: string; data: T | null; isLoading: boolean; error: string | null }>({ owner:null,key:'',data:null,isLoading:false,error:null });
 const refresh = useCallback(async () => {
  const request = ++generation.current;
  if (!owner) return;
  setState(previous => ({ owner,key,data: previous.owner === owner && previous.key === key ? previous.data : null,isLoading:true,error:null }));
  try { await assertIdentity(owner); const data = await loaderRef.current(); await assertIdentity(owner); if (generation.current === request) setState({ owner,key,data,isLoading:false,error:null }); }
  catch (error) { if (generation.current === request) setState({ owner,key,data:null,isLoading:false,error:dataError(error).message }); }
 },[owner,key]);
 useFocusEffect(useCallback(() => {
  loaderRef.current = loader;
  const unsubscribe = dependsOnSleep(key) ? subscribeSleepChanges(changedOwner => {
   if (changedOwner === owner) void refresh();
  }) : () => {};
  void refresh();
  return () => { unsubscribe(); generation.current++; };
  // loader is intentionally keyed by its serialized query parameters, not function identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[refresh,key]));
 const matches = owner !== null && state.owner === owner && state.key === key;
 return { data: matches ? state.data : null, isLoading: Boolean(owner) && (!matches || state.isLoading), error: matches ? state.error : null, refresh };
}
