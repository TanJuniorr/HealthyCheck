import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {useAuth} from '../contexts/AuthContext';
import {getArticleFeed,type ArticleQuery} from '../services/articlesService';
import {dataError} from '../lib/dataErrors';
import type {ArticlePage} from '../types/articles';
type State=ArticlePage & {key:string;isLoading:boolean;loadingMore:boolean;error:string|null};
export function useArticleFeed(options:ArticleQuery){
 const {user}=useAuth(),owner=user?.id??null;
 const {language,search='',category=null,mode='latest',status=null,pageSize=12}=options;
 const query=search.normalize('NFC').trim(),key=JSON.stringify([owner,language,query,category,mode,status,pageSize]);
 const [state,setState]=useState<State>({key:'',data:[],total:0,page:0,hasMore:false,isLoading:false,loadingMore:false,error:null});
 const generation=useRef(0),loading=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  if(!owner)return;const request=++generation.current;loading.current=null;
  setState({key,data:[],total:0,page:0,hasMore:false,isLoading:true,loadingMore:false,error:null});
  try{const result=await getArticleFeed({language,search:query,category,mode,status,pageSize,page:1});if(generation.current===request)setState({key,...result,isLoading:false,loadingMore:false,error:null});}
  catch(error){if(generation.current===request)setState({key,data:[],total:0,page:0,hasMore:false,isLoading:false,loadingMore:false,error:dataError(error).message});}
 },[owner,key,language,query,category,mode,status,pageSize]);
 useFocusEffect(useCallback(()=>{const timer=setTimeout(()=>{void refresh();},query?300:0);return()=>{clearTimeout(timer);generation.current++;loading.current=null;};},[refresh,query]));
 const matches=!!owner&&state.key===key;
 const loadMore=useCallback(async()=>{
  if(!matches||state.isLoading||state.loadingMore||!state.hasMore||loading.current===key)return;
  const request=generation.current;loading.current=key;setState(s=>({...s,loadingMore:true,error:null}));
  try{const result=await getArticleFeed({language,search:query,category,mode,status,pageSize,page:state.page+1});if(generation.current===request)setState(s=>({...s,...result,data:[...new Map([...s.data,...result.data].map(a=>[a.id,a])).values()],loadingMore:false,error:null}));}
  catch(error){if(generation.current===request)setState(s=>({...s,loadingMore:false,error:dataError(error).message}));}
  finally{if(generation.current===request)loading.current=null;}
 },[matches,state.isLoading,state.loadingMore,state.hasMore,state.page,key,language,query,category,mode,status,pageSize]);
 return {data:matches?state.data:[],total:matches?state.total:0,hasMore:matches&&state.hasMore,isLoading:!!owner&&(!matches||state.isLoading),loadingMore:matches&&state.loadingMore,error:matches?state.error:null,refresh,loadMore};
}
