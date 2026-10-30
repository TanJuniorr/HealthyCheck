import React,{useEffect,useState} from 'react';
import {Image,View,Text,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {useThemedStyles} from '../../contexts/ThemeContext';
import {getArticleImageUrl} from '../../services/articleImages';
import {Colors} from '../../constants/colors';
import {TextButton} from '../common/Buttons';
export function ArticleImage({path,label,thumbnail=false}:{path:string|null;label:string;thumbnail?:boolean}){
 const {user}=useAuth(),owner=user?.id,styles=useThemedStyles(baseStyles),{t}=useTranslation();
 const [state,setState]=useState<{key:string;url:string|null;failed:boolean}>({key:'',url:null,failed:false}),[attempt,setAttempt]=useState(0),key=owner+':'+path;
 useEffect(()=>{let alive=true;if(!path||!owner)return;void getArticleImageUrl(path).then(url=>{if(alive)setState({key,url,failed:false});}).catch(()=>{if(alive)setState({key,url:null,failed:true});});return()=>{alive=false;};},[path,owner,key,attempt]);
 const current=state.key===key?state:null;
 return <View style={[styles.frame,{height:thumbnail?90:220}]}>{current?.url&&!current.failed?<Image source={{uri:current.url}} accessibilityLabel={label} style={styles.image} resizeMode="cover" onError={()=>setState({key,url:null,failed:true})}/>:<View style={styles.placeholder}><Ionicons name="book-outline" color={Colors.primary} size={thumbnail?28:44}/>{current?.failed&&!thumbnail?<><Text style={styles.text}>{t('cms.imageUnavailable')}</Text><TextButton title={t('common.retry')} onPress={()=>setAttempt(a=>a+1)}/></>:null}</View>}</View>;
}
const baseStyles=StyleSheet.create({frame:{width:'100%',backgroundColor:Colors.primaryLight,borderRadius:16,overflow:'hidden'},image:{width:'100%',height:'100%'},placeholder:{flex:1,alignItems:'center',justifyContent:'center'},text:{color:Colors.textSecondary}});
