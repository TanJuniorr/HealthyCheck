import React from 'react';
import {View,Text} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useHealthQuery} from '../../../src/hooks/useHealthQuery';
import {getArticle,getArticleCategories,getArticleTranslations} from '../../../src/services/articlesService';
import {DataFeedback} from '../../../src/components/common/DataFeedback';
import {AdminArticleEditor} from '../../../src/components/articles/AdminArticleEditor';
import {Colors} from '../../../src/constants/colors';
export default function ArticleEditorRoute(){
 const {id}=useLocalSearchParams<{id:string}>(),{t}=useTranslation();
 const query=useHealthQuery(async()=>({article:id==='new'?null:await getArticle(id,'vi'),translations:id==='new'?[]:await getArticleTranslations(id),categories:await getArticleCategories(true)}),'article-admin-editor:'+id);
 if(!query.data)return <View style={{padding:24}}><DataFeedback {...query}/></View>;
 if(id!=='new'&&!query.data.article)return <Text style={{padding:24,color:Colors.textPrimary}}>{t('cms.unavailable')}</Text>;
 return <AdminArticleEditor key={id+':'+query.data.article?.updated_at} initial={query.data.article} initialTranslations={query.data.translations} categories={query.data.categories} reload={query.refresh}/>;
}
