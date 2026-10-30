import React,{useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {setArticleBookmark} from '../../services/articlesService';
import {dataError} from '../../lib/dataErrors';
import {localizeMessage} from '../../i18n/localize';
import {TextButton} from '../common/Buttons';
import {Colors} from '../../constants/colors';
type Props={id:string;saved:boolean;onChanged?:()=>void};
export function BookmarkButton(props:Props){
 const {user}=useAuth();return <BookmarkControl key={`${user?.id}:${props.id}:${props.saved}`} {...props} owner={user?.id}/>;
}
export function BookmarkControl({id,saved,onChanged,owner}:Props & {owner?:string}){
 const {t}=useTranslation(),[value,setValue]=useState(saved),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const toggle=async()=>{if(lock.current||!owner)return;lock.current=true;setBusy(true);setError(null);
  try{await setArticleBookmark(id,!value);if(mounted.current){setValue(!value);onChanged?.();}}
  catch(e){if(mounted.current)setError(dataError(e).message);}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 return <View><TextButton title={t(value?'articles.removeBookmark':'articles.bookmark')} onPress={toggle} loading={busy}/>{error?<Text accessibilityRole="alert" style={{color:Colors.error}}>{localizeMessage(error)}</Text>:null}</View>;
}
