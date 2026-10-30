import React,{useRef,useState} from 'react';
import {View,Text,ScrollView,StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {getArticleCategories,getArticleInterests,setArticleInterest} from '../../src/services/articlesService';
import {categoryName} from '../../src/lib/articleContent';
import {dataError} from '../../src/lib/dataErrors';
import {localizeMessage} from '../../src/i18n/localize';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {Colors} from '../../src/constants/colors';
import {AppHeader} from '../../src/components/common/AppHeader';
import {DataFeedback} from '../../src/components/common/DataFeedback';
import {TextButton} from '../../src/components/common/Buttons';
export default function ArticleInterests(){
 const {t,i18n}=useTranslation(),styles=useThemedStyles(baseStyles),query=useHealthQuery(async()=>({categories:await getArticleCategories(),selected:await getArticleInterests()}),'article-interests');
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),lock=useRef(false);
 const toggle=async(id:string)=>{if(lock.current||!query.data)return;lock.current=true;setBusy(true);setError(null);try{await setArticleInterest(id,!query.data.selected.includes(id));await query.refresh();}catch(e){setError(dataError(e).message);}finally{lock.current=false;setBusy(false);}};
 return <View style={styles.screen}><AppHeader title={t('cms.chooseInterests')} showBack/><ScrollView contentContainerStyle={styles.content}><Text style={styles.text}>{t('cms.recommendationInfo')}</Text><DataFeedback {...query}/>{error?<Text style={styles.error} accessibilityRole="alert">{localizeMessage(error)}</Text>:null}{query.data?.categories.map(c=><View key={c.id} style={styles.row}><Text style={styles.text}>{categoryName(c,i18n.resolvedLanguage??'vi')}</Text><TextButton disabled={busy} title={t(query.data?.selected.includes(c.id)?'cms.following':'cms.follow')} onPress={()=>toggle(c.id)}/></View>)}</ScrollView></View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{padding:20,gap:16,maxWidth:800,width:'100%',alignSelf:'center'},text:{color:Colors.textPrimary,fontSize:16,lineHeight:24},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',borderBottomWidth:1,borderColor:Colors.border},error:{color:Colors.error}});
