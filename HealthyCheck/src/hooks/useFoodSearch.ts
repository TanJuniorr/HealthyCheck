import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { getAllFoods } from '../services/foodsService';
import { dataError } from '../lib/dataErrors';
import type { FoodRow } from '../types/database';
import type { FoodGroup } from '../lib/foodPortions';
type State={key:string;data:FoodRow[];page:number;total:number;isLoading:boolean;loadingMore:boolean;error:string|null;hasMore:boolean};
export function useFoodSearch(search:string,category:FoodGroup|null) {
 const {user}=useAuth(),owner=user?.id??null,query=search.normalize('NFC').trim(),key=JSON.stringify([owner,query,category]);
 const [state,setState]=useState<State>({key:'',data:[],page:0,total:0,isLoading:false,loadingMore:false,error:null,hasMore:false});
 const generation=useRef(0),more=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  if(!owner)return;const request=++generation.current;more.current=null;
  setState({key,data:[],page:0,total:0,isLoading:true,loadingMore:false,error:null,hasMore:false});
  try {const result=await getAllFoods({search:query,category:category??undefined,page:1,pageSize:30});
   if(generation.current===request)setState({key,...result,data:result.data,isLoading:false,loadingMore:false,error:null});
  }catch(e){if(generation.current===request)setState({key,data:[],page:0,total:0,isLoading:false,loadingMore:false,error:dataError(e).message,hasMore:false});}
 },[owner,key,query,category]);
 useFocusEffect(useCallback(()=>{
  const timer=setTimeout(()=>{void refresh();},query?300:0);
  return()=>{clearTimeout(timer);generation.current++;more.current=null;};
 },[refresh,query]));
 const matches=Boolean(owner)&&state.key===key;
 const loadMore=useCallback(async()=>{
  if(!matches||state.isLoading||state.loadingMore||!state.hasMore||more.current===key)return;
  more.current=key;const request=generation.current;
  setState(previous=>({...previous,loadingMore:true,error:null}));
  try {const result=await getAllFoods({search:query,category:category??undefined,page:state.page+1,pageSize:30});
   if(generation.current===request)setState(previous=>({...previous,data:[...new Map([...previous.data,...result.data].map(food=>[food.id,food])).values()],page:result.page,total:result.total,hasMore:result.hasMore,loadingMore:false,error:null}));
  }catch(e){if(generation.current===request)setState(previous=>({...previous,loadingMore:false,error:dataError(e).message}));}
  finally{if(generation.current===request&&more.current===key)more.current=null;}
 },[matches,state.isLoading,state.loadingMore,state.hasMore,state.page,key,query,category]);
 return {data:matches?state.data:null,total:matches?state.total:0,isLoading:Boolean(owner)&&(!matches||state.isLoading),error:matches?state.error:null,loadingMore:matches&&state.loadingMore,hasMore:matches&&state.hasMore,refresh,loadMore};
}
