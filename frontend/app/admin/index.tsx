import React,{useRef,useState} from 'react';
import {View,Text,FlatList,StyleSheet,TextInput,Modal} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {Colors} from '../../src/constants/colors';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {useArticleFeed} from '../../src/hooks/useArticleFeed';
import {getArticleStats,changeArticleStatus,deleteArticle} from '../../src/services/articlesService';
import {articleLanguage} from '../../src/lib/articleContent';
import {formatDate,formatNumber} from '../../src/i18n/formatting';
import {TextButton,PrimaryButton} from '../../src/components/common/Buttons';
import {DataFeedback} from '../../src/components/common/DataFeedback';
import {dataError} from '../../src/lib/dataErrors';
import {localizeMessage} from '../../src/i18n/localize';
import type {ArticleCardRow,ArticleStatus} from '../../src/types/articles';
export default function AdminDashboard(){
 const {t,i18n}=useTranslation(),styles=useThemedStyles(baseStyles),[status,setStatus]=useState<ArticleStatus|null>(null),[search,setSearch]=useState('');
 const stats=useHealthQuery(getArticleStats,'article-admin-stats'),feed=useArticleFeed({language:articleLanguage(i18n.resolvedLanguage??'vi'),mode:'admin',status,search});
 const [selected,setSelected]=useState<ArticleCardRow|null>(null),[action,setAction]=useState<ArticleStatus|'delete'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),lock=useRef(false);
 const mutate=async()=>{
  if(lock.current||!selected||!action)return;lock.current=true;setBusy(true);setError(null);
  try{if(action==='delete')await deleteArticle(selected.id,selected.updated_at);else await changeArticleStatus(selected.id,selected.updated_at,action);setSelected(null);setAction(null);await Promise.all([stats.refresh(),feed.refresh()]);}
  catch(e){setError(dataError(e).message);}finally{lock.current=false;setBusy(false);}
 };
 return <View style={{flex:1}}><FlatList data={feed.data} keyExtractor={a=>a.id} contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.header}><Text style={styles.title} accessibilityRole="header">{t('cms.dashboard')}</Text><DataFeedback {...stats}/><View style={styles.row}>{(['total','published','draft','archived'] as const).map(key=><View key={key} style={styles.stat}><Text style={styles.text}>{t(`cms.status.${key}`)}</Text><Text style={styles.title}>{stats.data?formatNumber(stats.data[key]):'—'}</Text></View>)}</View><View style={styles.row}><PrimaryButton title={t('cms.newArticle')} onPress={()=>router.push('/admin/editor/new')}/><TextButton title={t('cms.categories')} onPress={()=>router.push('/admin/categories')}/></View><TextInput accessibilityLabel={t('explore.search')} value={search} onChangeText={setSearch} maxLength={160} placeholder={t('explore.search')} placeholderTextColor={Colors.textMuted} style={styles.input}/><View style={styles.row}>{[null,'published','draft','archived'].map(s=><TextButton key={s??'all'} title={t(s?`cms.status.${s}`:'category.all')} color={status===s?Colors.primary:Colors.textSecondary} onPress={()=>setStatus(s as ArticleStatus|null)}/>)}</View><Text style={styles.text}>{t('cms.recentlyEdited')}</Text><DataFeedback {...feed}/></View>}
 refreshing={feed.isLoading} onRefresh={()=>{void Promise.all([stats.refresh(),feed.refresh()]);}}
 ListEmptyComponent={!feed.isLoading&&!feed.error?<Text style={styles.text}>{t('cms.libraryEmpty')}</Text>:undefined}
 ListFooterComponent={feed.hasMore?<TextButton title={t('cms.loadMore')} loading={feed.loadingMore} onPress={feed.loadMore}/>:undefined}
 onEndReached={()=>{if(feed.hasMore&&!feed.error)void feed.loadMore();}}
 renderItem={({item})=><View style={styles.item}><View style={{flex:1}}><Text style={styles.text}>{item.title||t('cms.untitled')}</Text><Text style={styles.note}>{t(`cms.status.${item.status}`)} · {formatDate(item.updated_at)}</Text></View><View style={styles.row}><TextButton title={t('cms.preview')} onPress={()=>router.push({pathname:'/article/[id]',params:{id:item.id}})}/><TextButton title={t('common.edit')} onPress={()=>router.push({pathname:'/admin/editor/[id]',params:{id:item.id}})}/><TextButton title={t('cms.actions')} onPress={()=>{setSelected(item);setAction(null);setError(null);}}/></View></View>}/>
 <Modal visible={!!selected} transparent animationType="fade" onRequestClose={()=>{if(!busy)setSelected(null);}}><View style={styles.overlay}><View style={styles.dialog}>
  <Text style={styles.title}>{action?t(action==='delete'?'cms.confirmDelete':action==='published'?'cms.confirmPublish':'cms.confirmStatus'):selected?.title||t('cms.untitled')}</Text>
  {error?<Text style={styles.error} accessibilityRole="alert">{localizeMessage(error)}</Text>:null}
  {action?<><Text style={styles.note}>{t(action==='published'?'cms.missingTranslationHint':'cms.confirmActionHint')}</Text><PrimaryButton title={t('cms.confirm')} loading={busy} onPress={mutate}/></>:<>
   {selected?.status!=='published'?<TextButton title={t('cms.publish')} onPress={()=>setAction('published')}/>:<TextButton title={t('cms.unpublish')} onPress={()=>setAction('draft')}/>}
   {selected?.status==='archived'?<TextButton title={t('cms.saveDraft')} onPress={()=>setAction('draft')}/>:<TextButton title={t('cms.archive')} onPress={()=>setAction('archived')}/>}
   <TextButton title={t('common.delete')} color={Colors.error} onPress={()=>setAction('delete')}/>
  </>}
  <TextButton title={t('common.cancel')} disabled={busy} onPress={()=>{setSelected(null);setAction(null);}}/>
 </View></View></Modal></View>;
}
const baseStyles=StyleSheet.create({overlay:{flex:1,backgroundColor:Colors.overlay,justifyContent:'center',alignItems:'center',padding:20},dialog:{backgroundColor:Colors.surface,padding:20,borderRadius:16,gap:12,width:'100%',maxWidth:500},error:{color:Colors.error},content:{padding:24,gap:12,width:'100%',maxWidth:1200,alignSelf:'center'},header:{gap:16},title:{fontSize:26,color:Colors.textPrimary,fontWeight:'700'},text:{fontSize:16,lineHeight:24,color:Colors.textPrimary},note:{fontSize:14,lineHeight:22,color:Colors.textSecondary},row:{flexDirection:'row',gap:12,flexWrap:'wrap'},stat:{padding:20,borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.surface,minWidth:130,gap:8,flexGrow:1},input:{padding:14,borderWidth:1,borderColor:Colors.border,borderRadius:12,backgroundColor:Colors.surface,color:Colors.textPrimary,fontSize:16},item:{flexDirection:'row',flexWrap:'wrap',gap:12,padding:16,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:12}});
