import React,{useState} from 'react';
import {View,Text,FlatList,StyleSheet,TextInput} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {Colors} from '../../src/constants/colors';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {useArticleFeed} from '../../src/hooks/useArticleFeed';
import {getArticleStats} from '../../src/services/articlesService';
import {articleLanguage} from '../../src/lib/articleContent';
import {formatDate,formatNumber} from '../../src/i18n/formatting';
import {TextButton,PrimaryButton} from '../../src/components/common/Buttons';
import {DataFeedback} from '../../src/components/common/DataFeedback';
import type {ArticleStatus} from '../../src/types/articles';
export default function AdminDashboard(){
 const {t,i18n}=useTranslation(),styles=useThemedStyles(baseStyles),[status,setStatus]=useState<ArticleStatus|null>(null),[search,setSearch]=useState('');
 const stats=useHealthQuery(getArticleStats,'article-admin-stats'),feed=useArticleFeed({language:articleLanguage(i18n.resolvedLanguage??'vi'),mode:'admin',status,search});
 return <FlatList data={feed.data} keyExtractor={a=>a.id} contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.header}><Text style={styles.title} accessibilityRole="header">{t('cms.dashboard')}</Text><DataFeedback {...stats}/><View style={styles.row}>{(['total','published','draft','archived'] as const).map(key=><View key={key} style={styles.stat}><Text style={styles.text}>{t(`cms.status.${key}`)}</Text><Text style={styles.title}>{stats.data?formatNumber(stats.data[key]):'—'}</Text></View>)}</View><PrimaryButton title={t('cms.newArticle')} onPress={()=>router.push('/admin/editor/new')}/><TextInput accessibilityLabel={t('explore.search')} value={search} onChangeText={setSearch} maxLength={160} placeholder={t('explore.search')} placeholderTextColor={Colors.textMuted} style={styles.input}/><View style={styles.row}>{[null,'published','draft','archived'].map(s=><TextButton key={s??'all'} title={t(s?`cms.status.${s}`:'category.all')} color={status===s?Colors.primary:Colors.textSecondary} onPress={()=>setStatus(s as ArticleStatus|null)}/>)}</View><Text style={styles.text}>{t('cms.recentlyEdited')}</Text><DataFeedback {...feed}/></View>}
 ListEmptyComponent={!feed.isLoading&&!feed.error?<Text style={styles.text}>{t('cms.libraryEmpty')}</Text>:undefined}
 ListFooterComponent={feed.hasMore?<TextButton title={t('cms.loadMore')} loading={feed.loadingMore} onPress={feed.loadMore}/>:undefined}
 onEndReached={()=>{if(feed.hasMore&&!feed.error)void feed.loadMore();}}
 renderItem={({item})=><View style={styles.item}><View style={{flex:1}}><Text style={styles.text}>{item.title||t('cms.untitled')}</Text><Text style={styles.note}>{t(`cms.status.${item.status}`)} · {formatDate(item.updated_at)}</Text></View><TextButton title={t('common.edit')} onPress={()=>router.push({pathname:'/admin/editor/[id]',params:{id:item.id}})}/></View>}/>;
}
const baseStyles=StyleSheet.create({content:{padding:24,gap:12,width:'100%',maxWidth:1200,alignSelf:'center'},header:{gap:16},title:{fontSize:26,color:Colors.textPrimary,fontWeight:'700'},text:{fontSize:16,lineHeight:24,color:Colors.textPrimary},note:{fontSize:14,lineHeight:22,color:Colors.textSecondary},row:{flexDirection:'row',gap:12,flexWrap:'wrap'},stat:{padding:20,borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.surface,minWidth:160,gap:8,flexGrow:1},input:{padding:14,borderWidth:1,borderColor:Colors.border,borderRadius:12,backgroundColor:Colors.surface,color:Colors.textPrimary,fontSize:16},item:{flexDirection:'row',flexWrap:'wrap',gap:12,padding:16,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:12}});
