import React,{useEffect,useState} from 'react';
import {View,Text,ScrollView,StyleSheet,Linking,Share} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {getArticle,getArticleFeed,recordArticleRead} from '../../src/services/articlesService';
import {articleLanguage,categoryName,safeArticleUrl} from '../../src/lib/articleContent';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {Colors} from '../../src/constants/colors';
import {formatDate} from '../../src/i18n/formatting';
import {AppHeader} from '../../src/components/common/AppHeader';
import {DataFeedback} from '../../src/components/common/DataFeedback';
import {TextButton} from '../../src/components/common/Buttons';
import {ArticleImage} from '../../src/components/articles/ArticleImage';
import {ArticleMarkdown} from '../../src/components/articles/ArticleMarkdown';
import {ArticleCard} from '../../src/components/articles/ArticleCard';
import {BookmarkButton} from '../../src/components/articles/BookmarkButton';
export default function ArticleDetailScreen(){
 const {id}=useLocalSearchParams<{id:string}>(),{t,i18n}=useTranslation(),language=articleLanguage(i18n.resolvedLanguage??'vi'),styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets();
 const query=useHealthQuery(()=>getArticle(id,language),JSON.stringify(['article-detail',id,language]));
 const article=query.data,tr=article?.translation,[readFailed,setReadFailed]=useState(false),[linkFailed,setLinkFailed]=useState(false),[shareFailed,setShareFailed]=useState(false);
 const related=useHealthQuery(async()=>article?(await getArticleFeed({language,category:article.category_id,pageSize:5})).data.filter(a=>a.id!==id).slice(0,3):[],JSON.stringify(['article-related',id,article?.category_id,language]));
 useEffect(()=>{let alive=true;if(!article||article.status!=='published')return;void recordArticleRead(article.id).then(()=>{if(alive)setReadFailed(false);}).catch(()=>{if(alive)setReadFailed(true);});return()=>{alive=false;};},[article?.id,article?.status,article]);
 return <View style={styles.screen}><AppHeader title={t('navigation.explore')} showBack/><ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+30}]}><DataFeedback {...query}/>{!query.isLoading&&!query.error&&!article?<Text style={styles.title}>{t('cms.unavailable')}</Text>:null}
  {article&&tr?<><ArticleImage path={article.cover_image_path} label={tr.title}/><Text style={styles.category}>{categoryName(article.category,language)} · {t('articles.readTime',{count:tr.reading_time_minutes})}</Text>
   {tr.language!==language?<Text style={styles.note}>{t('cms.languageFallback',{language:t(tr.language==='vi'?'cms.languages.vi':'cms.languages.en')})}</Text>:null}
   <Text accessibilityRole="header" style={styles.title}>{tr.title}</Text><Text style={styles.note}>{tr.source_name}{article.published_at?' · '+formatDate(article.published_at):''}</Text><Text style={styles.summary}>{tr.summary}</Text>
   <BookmarkButton id={id} saved={article.is_bookmarked}/><TextButton title={t('articles.shareLabel')} onPress={async()=>{try{await Share.share({title:tr.title,message:t('articles.share',{title:tr.title})+'\n'+tr.source_url});setShareFailed(false);}catch{setShareFailed(true);}}}/>{shareFailed?<Text accessibilityRole="alert" style={styles.error}>{t('errors.general')}</Text>:null}<ArticleMarkdown content={tr.content}/>
   <Text style={styles.heading}>{t('cms.references')}</Text>{[{name:tr.source_name,url:tr.source_url},...tr.reference_links].filter(r=>r.name&&safeArticleUrl(r.url)).map((r,i)=><TextButton key={i} title={r.name} onPress={async()=>{try{await Linking.openURL(safeArticleUrl(r.url)!);setLinkFailed(false);}catch{setLinkFailed(true);}}}/>)}
   {linkFailed?<Text accessibilityRole="alert" style={styles.error}>{t('cms.linkFailed')}</Text>:null}
   {readFailed?<><Text accessibilityRole="alert" style={styles.error}>{t('cms.historyFailed')}</Text><TextButton title={t('common.retry')} onPress={async()=>{try{await recordArticleRead(id);setReadFailed(false);}catch{setReadFailed(true);}}}/></>:null}
   <Text style={styles.heading}>{t('cms.related')}</Text><DataFeedback {...related}/>{related.data?.map(a=><ArticleCard key={a.id} article={a}/>)}</>:null}
 </ScrollView></View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{padding:20,gap:16,maxWidth:850,width:'100%',alignSelf:'center'},title:{fontSize:28,lineHeight:36,fontWeight:'700',color:Colors.textPrimary},category:{fontSize:14,color:Colors.primary},note:{fontSize:14,lineHeight:22,color:Colors.textSecondary},summary:{fontSize:17,lineHeight:26,color:Colors.textPrimary},heading:{fontSize:22,fontWeight:'700',color:Colors.textPrimary,marginTop:20},error:{color:Colors.error}});
