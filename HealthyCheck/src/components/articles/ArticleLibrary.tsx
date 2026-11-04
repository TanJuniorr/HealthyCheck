import React from 'react';
import {FlatList,View,Text,StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useArticleFeed} from '../../hooks/useArticleFeed';
import {articleLanguage} from '../../lib/articleContent';
import {AppHeader} from '../common/AppHeader';
import {DataFeedback} from '../common/DataFeedback';
import {TextButton} from '../common/Buttons';
import {ArticleCard} from './ArticleCard';
import {useThemedStyles} from '../../contexts/ThemeContext';
import {Colors} from '../../constants/colors';
export function ArticleLibrary({mode}:{mode:'bookmarks'|'history'}){
 const {t,i18n}=useTranslation(),insets=useSafeAreaInsets(),styles=useThemedStyles(baseStyles),query=useArticleFeed({mode,language:articleLanguage(i18n.resolvedLanguage??'vi')});
 return <View style={styles.screen}><AppHeader title={t(mode==='bookmarks'?'cms.savedArticles':'cms.readHistory')} showBack/><FlatList data={query.data} keyExtractor={a=>a.id} contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+30}]} ListHeaderComponent={<DataFeedback {...query}/>} ListEmptyComponent={!query.isLoading&&!query.error?<Text style={styles.note}>{t('cms.libraryEmpty')}</Text>:undefined} onEndReached={()=>{if(query.hasMore&&!query.error)void query.loadMore();}} ListFooterComponent={query.hasMore?<TextButton title={t('cms.loadMore')} onPress={query.loadMore} loading={query.loadingMore}/>:undefined} renderItem={({item})=><ArticleCard article={item} onBookmarkChanged={mode==='bookmarks'?()=>void query.refresh():undefined}/>}/></View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{padding:20,maxWidth:900,width:'100%',alignSelf:'center'},note:{color:Colors.textSecondary,fontSize:16}});
