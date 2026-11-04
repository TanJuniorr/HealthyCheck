import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useAuth} from './AuthContext';
import {getArticleRole} from '../services/articlesService';
import {dataError} from '../lib/dataErrors';

type RoleState = {owner:string|null; data:'admin'|'user'|null; error:string|null};
type RoleValue = {data:RoleState['data']; lastVerifiedAdmin:boolean; isLoading:boolean; error:string|null; refresh:()=>Promise<void>};
const ArticleRoleContext = createContext<RoleValue|null>(null);

// One server-owned role shared by Explore and every admin route. Never use email or metadata.
export function ArticleRoleProvider({children}:React.PropsWithChildren) {
 const {user}=useAuth();
 return <ArticleRoleSession key={user?.id??'guest'}>{children}</ArticleRoleSession>;
}
function ArticleRoleSession({children}:React.PropsWithChildren) {
 const {user,isLoading}=useAuth(), owner=user?.id??null;
 const [state,setState]=useState<RoleState>({owner:null,data:null,error:null});
 const generation=useRef(0);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 const refresh=useCallback(async()=>{
  const request=++generation.current;
  if(!owner)return;
  try {
   const data=await getArticleRole();
   if(request===generation.current)setState({owner,data,error:null});
  } catch(error) {
   if(request===generation.current)setState(previous=>({owner,data:previous.owner===owner?previous.data:null,error:dataError(error).message}));
  }
 },[owner]);
 useEffect(()=>{
  let alive=true;
  void Promise.resolve().then(()=>{if(alive)return refresh();});
  let timer:ReturnType<typeof setTimeout>;
  const poll=()=>{timer=setTimeout(async()=>{if(AppState.currentState==='active')await refresh();if(alive)poll();},30000);};
  poll();
  const listener=AppState.addEventListener('change',next=>{if(next==='active')void refresh();});
  return()=>{alive=false;clearTimeout(timer);invalidate();listener.remove();};
 },[refresh,invalidate]);
 const matches=!!owner&&state.owner===owner;
 return <ArticleRoleContext.Provider value={{data:matches&&!state.error?state.data:null,lastVerifiedAdmin:matches&&state.data==='admin',isLoading:isLoading||!!owner&&(!matches||!state.data&&!state.error),error:matches?state.error:null,refresh}}>{children}</ArticleRoleContext.Provider>;
}
export function useArticleRole(){
 const value=useContext(ArticleRoleContext);
 if(!value)throw new Error('useArticleRole requires ArticleRoleProvider');
 return value;
}
