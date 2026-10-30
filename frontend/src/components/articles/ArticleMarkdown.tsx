import React,{useState} from 'react';
import {View,Text,StyleSheet,Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {articleBlocks,articleInlines,safeArticleUrl} from '../../lib/articleContent';
import {useThemedStyles} from '../../contexts/ThemeContext';
import {Colors} from '../../constants/colors';
import {ArticleImage} from './ArticleImage';
export function ArticleMarkdown({content}:{content:string}){
 const styles=useThemedStyles(baseStyles),[failed,setFailed]=useState(false),{t}=useTranslation();
 const open=async(url:string)=>{const safe=safeArticleUrl(url);if(!safe){setFailed(true);return;}try{await Linking.openURL(safe);setFailed(false);}catch{setFailed(true);}};
 return <View style={styles.content}>{articleBlocks(content).map((block,index)=>block.type==='image'?<ArticleImage key={index} path={block.url!} label={block.text}/>:<Text key={index} selectable accessibilityRole={block.type==='h2'||block.type==='h3'?'header':'text'} style={[styles.text,block.type==='h2'&&styles.h2,block.type==='h3'&&styles.h3,block.type==='list'&&styles.list]}>{block.type==='list'?'• ':''}{articleInlines(block.text).map((part,i)=><Text key={i} style={part.type==='bold'?styles.bold:part.type==='italic'?styles.italic:part.type==='link'?styles.link:undefined} accessibilityRole={part.type==='link'?'link':undefined} onPress={part.url?()=>void open(part.url!):undefined}>{part.text}</Text>)}</Text>)}{failed?<Text accessibilityRole="alert" style={styles.error}>{t('cms.linkFailed')}</Text>:null}</View>;
}
const baseStyles=StyleSheet.create({content:{gap:16},text:{fontSize:16,lineHeight:26,color:Colors.textPrimary},h2:{fontSize:22,lineHeight:30,fontWeight:'700',marginTop:12},h3:{fontSize:18,lineHeight:26,fontWeight:'700',marginTop:8},list:{paddingLeft:12},bold:{fontWeight:'700'},italic:{fontStyle:'italic'},link:{color:Colors.primary,textDecorationLine:'underline'},error:{color:Colors.error}});
