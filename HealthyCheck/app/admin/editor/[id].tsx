import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {ArticleEditorScreen} from '../../../src/components/articles/ArticleEditorScreen';
export default function EditArticle(){
 const {id}=useLocalSearchParams<{id:string}>();
 return <ArticleEditorScreen id={id}/>;
}
