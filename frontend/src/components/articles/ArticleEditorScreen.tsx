import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {getArticle,getArticleCategories,getArticleTranslations} from '../../services/articlesService';
import {dataError} from '../../lib/dataErrors';
import {DataFeedback} from '../common/DataFeedback';
import {AdminArticleEditor} from './AdminArticleEditor';
import {Colors} from '../../constants/colors';

// Reload only on identity/route change or explicit confirmation. Focus/foreground
// refreshes must never replace an editor that contains unsaved work.
export function ArticleEditorScreen({id}:{id:string}){
 const {user}=useAuth(),owner=user?.id??null,{t}=useTranslation(),generation=useRef(0);
 const key=owner+':'+id;
 const invalidate=useCallback(()=>{generation.current++;},[]);
 const [state,setState]=useState<{key:string;data:Awaited<ReturnType<typeof load>>|null;error:string|null;revision:number}>({key:'',data:null,error:null,revision:0});
 async function load(){
  const [article,translations,categories]=await Promise.all([id==='new'?null:getArticle(id,'vi'),id==='new'?[]:getArticleTranslations(id),getArticleCategories(true)]);
  return {article,translations,categories};
 }
 const refresh=useCallback(async()=>{
  if(!owner)return;
  const request=++generation.current;
  setState(s=>({...s,key,data:null,error:null}));
  try{const data=await load();if(request===generation.current)setState(s=>({key,data,error:null,revision:s.revision+1}));}
  catch(e){if(request===generation.current)setState(s=>({...s,key,data:null,error:dataError(e).message}));}
  // The loader depends only on the route id; account changes are part of key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,owner]);
 useEffect(()=>{let alive=true;void Promise.resolve().then(()=>{if(alive)return refresh();});return()=>{alive=false;invalidate();};},[refresh,invalidate]);
 const current=state.key===key?state:null;
 if(!current?.data)return <View style={{padding:24}}><DataFeedback isLoading={!current?.error} error={current?.error??null} refresh={refresh}/></View>;
 if(id!=='new'&&!current.data.article)return <Text style={{padding:24,color:Colors.textPrimary}}>{t('cms.unavailable')}</Text>;
 return <AdminArticleEditor key={key+':'+current.revision} initial={current.data.article} initialTranslations={current.data.translations} categories={current.data.categories} reload={refresh}/>;
}
