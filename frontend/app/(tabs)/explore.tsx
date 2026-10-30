import React,{useState} from 'react';
import {View,Text,FlatList,ScrollView,TextInput,StyleSheet,Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Colors} from '../../src/constants/colors';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {useArticleFeed} from '../../src/hooks/useArticleFeed';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {getArticleCategories} from '../../src/services/articlesService';
import {useArticleRole} from '../../src/contexts/ArticleRoleContext';
import {articleLanguage,categoryName} from '../../src/lib/articleContent';
import {ArticleCard} from '../../src/components/articles/ArticleCard';
import {DataFeedback} from '../../src/components/common/DataFeedback';
import {TextButton} from '../../src/components/common/Buttons';
export default function ExploreScreen(){
 const {t,i18n}=useTranslation(),styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets(),language=articleLanguage(i18n.resolvedLanguage??'vi');
 const [search,setSearch]=useState(''),[category,setCategory]=useState<string|null>(null);
 const categories=useHealthQuery(()=>getArticleCategories(),'article-categories');
 const role=useArticleRole();
 const latest=useArticleFeed({language,search,category}),featured=useArticleFeed({language,mode:'featured',pageSize:2}),recommended=useArticleFeed({language,mode:'recommended',pageSize:3});
 const browsing=!search.trim()&&!category;
 return <View style={[styles.screen,{paddingTop:insets.top}]}><FlatList data={latest.data} keyExtractor={a=>a.id} keyboardShouldPersistTaps="handled" initialNumToRender={8} windowSize={7} contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+110}]} onEndReached={()=>{if(latest.hasMore&&!latest.error)void latest.loadMore();}} onEndReachedThreshold={0.4}
  ListHeaderComponent={<View style={styles.header}>
   <View style={styles.titleRow}><Text style={styles.title} accessibilityRole="header">{t('navigation.explore')}</Text>{role.data==='admin'?<Pressable accessibilityRole="button" accessibilityLabel={t('cms.newArticle')} onPress={()=>router.push('/admin/editor/new')} style={styles.add}><Ionicons name="add" size={28} color={Colors.primary}/></Pressable>:null}</View><Text style={styles.description}>{t('explore.description')}</Text>
   <View style={styles.links}><TextButton title={t('cms.savedArticles')} onPress={()=>router.push('/article/saved')}/><TextButton title={t('cms.readHistory')} onPress={()=>router.push('/article/history')}/></View>
   {role.data==='admin'?<TextButton title={t('cms.manageArticles')} onPress={()=>router.push('/admin')}/>:null}
   <TextInput accessibilityLabel={t('explore.search')} placeholder={t('explore.search')} placeholderTextColor={Colors.textMuted} style={styles.search} value={search} onChangeText={setSearch} maxLength={160} autoCapitalize="none" clearButtonMode="while-editing"/>
   <DataFeedback {...categories}/><ScrollView horizontal showsHorizontalScrollIndicator={false}><TextButton title={t('category.all')} onPress={()=>setCategory(null)} color={!category?Colors.primary:Colors.textSecondary}/>{categories.data?.map(c=><TextButton key={c.id} title={categoryName(c,language)} color={category===c.id?Colors.primary:Colors.textSecondary} onPress={()=>setCategory(c.id)}/>)}</ScrollView>
   {browsing?<><TextButton title={t('cms.chooseInterests')} onPress={()=>router.push('/article/interests')}/><Text style={styles.section} accessibilityRole="header">{t('articles.featured')}</Text><DataFeedback {...featured}/>{featured.data.map(a=><ArticleCard key={a.id} article={a} featured/>)}
    <Text style={styles.section} accessibilityRole="header">{t('cms.forYou')}</Text><Text style={styles.description}>{t('cms.recommendationInfo')}</Text><DataFeedback {...recommended}/>{recommended.data.map(a=><ArticleCard key={a.id} article={a} recommendation/>)}</>:null}
   <Text style={styles.section} accessibilityRole="header">{t(search.trim()?'cms.searchResults':'explore.recent')}</Text><DataFeedback {...latest}/>
  </View>}
  ListEmptyComponent={!latest.isLoading&&!latest.error?<View style={styles.header}><Text style={styles.section}>{t('explore.empty')}</Text><Text style={styles.description}>{t('explore.emptyHint')}</Text></View>:undefined}
  ListFooterComponent={latest.hasMore?<TextButton title={t('cms.loadMore')} loading={latest.loadingMore} onPress={latest.loadMore}/>:undefined}
  refreshing={latest.isLoading} onRefresh={()=>{void Promise.all([latest.refresh(),featured.refresh(),recommended.refresh(),categories.refresh(),role.refresh()]);}}
  renderItem={({item})=><ArticleCard article={item}/>}/></View>;
}
const baseStyles=StyleSheet.create({titleRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},add:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:24,backgroundColor:Colors.primaryLight},screen:{flex:1,backgroundColor:Colors.background},content:{paddingHorizontal:20,maxWidth:900,width:'100%',alignSelf:'center'},header:{gap:12,paddingTop:16},title:{fontSize:30,fontWeight:'700',color:Colors.textPrimary},description:{fontSize:14,lineHeight:22,color:Colors.textSecondary},section:{fontSize:22,fontWeight:'700',color:Colors.textPrimary,marginVertical:12},search:{fontSize:16,color:Colors.textPrimary,backgroundColor:Colors.surface,borderColor:Colors.border,borderWidth:1,borderRadius:12,padding:14,minHeight:48},links:{flexDirection:'row',flexWrap:'wrap'}});
