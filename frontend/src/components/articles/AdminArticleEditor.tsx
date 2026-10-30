import React,{useRef,useState} from 'react';
import {View,Text,TextInput,ScrollView,Switch,Modal,StyleSheet} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {useThemedStyles} from '../../contexts/ThemeContext';
import {Colors} from '../../constants/colors';
import {articleSlug,categoryName,emptyArticleTranslation,parseArticleReferences,publicationReady} from '../../lib/articleContent';
import {dataError} from '../../lib/dataErrors';
import {localizeMessage} from '../../i18n/localize';
import {saveArticle,deleteArticle} from '../../services/articlesService';
import {deleteArticleImage,uploadArticleImage} from '../../services/articleImages';
import type {ArticleCategory,ArticleDetail,ArticleLanguage,ArticleRow,ArticleStatus,ArticleTranslation} from '../../types/articles';
import {TextButton,PrimaryButton} from '../common/Buttons';
import {ArticleMarkdown} from './ArticleMarkdown';
import {ArticleImage} from './ArticleImage';
type Props={initial:ArticleDetail|null;initialTranslations:ArticleTranslation[];categories:ArticleCategory[];reload:()=>Promise<void>};
export function AdminArticleEditor({initial,initialTranslations,categories,reload}:Props){
 const {t,i18n}=useTranslation(),{user}=useAuth(),styles=useThemedStyles(baseStyles);
 const [record,setRecord]=useState<ArticleRow|null>(initial),[slug,setSlug]=useState(initial?.slug??''),[category,setCategory]=useState(initial?.category_id??categories[0]?.id??''),[cover,setCover]=useState<string|null>(initial?.cover_image_path??null),[featured,setFeatured]=useState(initial?.is_featured??false);
 const [translations,setTranslations]=useState<Record<ArticleLanguage,ArticleTranslation>>(()=>({vi:initialTranslations.find(t=>t.language==='vi')??emptyArticleTranslation('vi'),en:initialTranslations.find(t=>t.language==='en')??emptyArticleTranslation('en')}));
 const [language,setLanguage]=useState<ArticleLanguage>('vi'),[refs,setRefs]=useState<Record<ArticleLanguage,string>>(()=>({vi:initialTranslations.find(t=>t.language==='vi')?.reference_links.map(r=>r.name+' | '+r.url).join('\n')??'',en:initialTranslations.find(t=>t.language==='en')?.reference_links.map(r=>r.name+' | '+r.url).join('\n')??''}));
 const [preview,setPreview]=useState(false),[confirm,setConfirm]=useState<'delete'|'published'|'draft'|'archived'|'reload'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null),lock=useRef(false),mounted=useRef(true);
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const tr=translations[language];
 const change=(key:keyof ArticleTranslation,value:string)=>setTranslations(s=>({...s,[language]:{...s[language],[key]:value}}));
 const payload=()=>Object.values(translations).filter(tr=>[tr.title,tr.summary,tr.content,tr.source_name,tr.source_url,refs[tr.language]].some(s=>s.trim())).map(tr=>({language:tr.language,title:tr.title.trim(),summary:tr.summary.trim(),content:tr.content.trim(),source_name:tr.source_name.trim(),source_url:tr.source_url.trim(),reference_links:parseArticleReferences(refs[tr.language]),reading_time_minutes:Math.min(120,Math.max(1,Math.ceil(tr.content.trim().split(/\s+/).length/200)))}));
 const save=async(status:ArticleStatus)=>{
  if(lock.current)return;const data=payload();if(!category||!(slug||articleSlug(translations.vi.title||translations.en.title))){setError('cms.requiredArticle');return;}
  if(status==='published'&&!publicationReady(data)){setError('cms.invalidPublication');return;}
  lock.current=true;setBusy(true);setError(null);setMessage(null);setConfirm(null);
  try{
   const saved=await saveArticle(record?.id??null,record?.updated_at??null,{slug:slug||articleSlug(translations.vi.title||translations.en.title),category_id:category,cover_image_path:cover,status,is_featured:featured},data);
   if(!mounted.current)return;
   const oldCover=record?.cover_image_path;setRecord(saved);setSlug(saved.slug);setMessage('cms.saved');
   if(oldCover&&oldCover!==cover&&oldCover.startsWith(user?.id+'/')&&!data.some(tr=>tr.content.includes('article-image:'+oldCover))){try{await deleteArticleImage(oldCover);}catch{if(mounted.current)setMessage('cms.savedImageRetained');}}
   if(!record)router.replace({pathname:'/admin/editor/[id]',params:{id:saved.id}});
  }catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const upload=async(inline:boolean)=>{if(lock.current)return;if(!record){setError('cms.saveBeforeImage');return;}lock.current=true;setBusy(true);setError(null);setMessage(null);
  try{const path=await uploadArticleImage(record.id,user!.id);if(path&&mounted.current){if(inline)setTranslations(s=>({...s,[language]:{...s[language],content:s[language].content+'\n\n!['+t('cms.imageAlt')+'](article-image:'+path+')\n'}}));else setCover(path);setMessage('cms.imageStaged');}}
  catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const remove=async()=>{if(lock.current||!record)return;lock.current=true;setBusy(true);setError(null);try{await deleteArticle(record.id,record.updated_at);if(mounted.current)router.replace('/admin');}catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current){setBusy(false);setConfirm(null);}}};
 const field=(key:'title'|'summary'|'content'|'source_name'|'source_url',label:string,multiline=false)=><View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={tr[key]} onChangeText={value=>change(key,value)} editable={!busy} multiline={multiline} maxLength={key==='content'?100000:key==='summary'?1200:key==='source_url'?2048:240} style={[styles.input,multiline&&{minHeight:key==='content'?300:90,textAlignVertical:'top'}]}/></View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
  <View style={styles.row}><Text style={styles.title} accessibilityRole="header">{t(record?'cms.editArticle':'cms.newArticle')}</Text><Text style={styles.note}>{t(`cms.status.${record?.status??'draft'}`)}</Text></View>
  <Text style={styles.note}>{t('cms.editorHint')}</Text>
  <Text style={styles.label}>{t('cms.slug')}</Text><TextInput accessibilityLabel={t('cms.slug')} value={slug} onChangeText={setSlug} editable={!busy} maxLength={160} autoCapitalize="none" placeholder={articleSlug(translations.vi.title||translations.en.title)} placeholderTextColor={Colors.textMuted} style={styles.input}/>
  <Text style={styles.label}>{t('cms.category')}</Text><View style={styles.row}>{categories.map(c=><TextButton key={c.id} disabled={busy} title={categoryName(c,i18n.resolvedLanguage??'vi')+(c.is_active?'':' · '+t('cms.hidden'))} color={category===c.id?Colors.primary:Colors.textSecondary} onPress={()=>setCategory(c.id)}/>)}</View>
  <View style={styles.row}><Text style={styles.label}>{t('articles.featured')}</Text><Switch accessibilityLabel={t('articles.featured')} value={featured} onValueChange={setFeatured} disabled={busy}/></View>
  {cover?<ArticleImage path={cover} label={t('cms.coverImage')}/>:null}<View style={styles.row}><TextButton title={t('cms.uploadCover')} disabled={busy} onPress={()=>upload(false)}/>{cover?<TextButton title={t('cms.removeCover')} disabled={busy} onPress={()=>{setCover(null);setMessage('cms.imageStaged');}}/>:null}</View><Text style={styles.note}>{t('cms.imageRules')}</Text>
  <View style={styles.row}>{(['vi','en'] as const).map(l=><TextButton key={l} title={t(`cms.languages.${l}`)} color={language===l?Colors.primary:Colors.textSecondary} disabled={busy} onPress={()=>setLanguage(l)}/>)}</View>
  {field('title',t('cms.articleTitle'))}{field('summary',t('cms.summary'),true)}
  <View style={styles.row}>{(['h2','h3','bold','italic','list','link'] as const).map(kind=><TextButton key={kind} title={t(`cms.format.${kind}`)} disabled={busy} onPress={()=>change('content',tr.content+'\n'+({h2:'## ',h3:'### ',bold:'**'+t('cms.formatText')+'**',italic:'*'+t('cms.formatText')+'*',list:'- ',link:'['+t('cms.formatText')+'](https://)'}[kind]))}/>)}<TextButton title={t('cms.insertImage')} disabled={busy} onPress={()=>upload(true)}/></View>
  {field('content',t('cms.content'),true)}{field('source_name',t('cms.sourceName'))}{field('source_url',t('cms.sourceUrl'))}
  <Text style={styles.label}>{t('cms.extraReferences')}</Text><TextInput accessibilityLabel={t('cms.extraReferences')} value={refs[language]} onChangeText={value=>setRefs(s=>({...s,[language]:value}))} editable={!busy} multiline maxLength={20000} style={[styles.input,{minHeight:100,textAlignVertical:'top'}]}/>
  {error?<Text style={styles.error} accessibilityRole="alert">{localizeMessage(error)}</Text>:null}{message?<Text style={styles.note} accessibilityLiveRegion="polite">{t(message)}</Text>:null}
  <View style={styles.row}><PrimaryButton title={t('common.save')} loading={busy} onPress={()=>save(record?.status??'draft')}/><TextButton title={t('cms.saveDraft')} disabled={busy} onPress={()=>record?.status==='published'?setConfirm('draft'):void save('draft')}/><TextButton title={t('cms.preview')} disabled={busy} onPress={()=>setPreview(true)}/><TextButton title={t('cms.publish')} disabled={busy} onPress={()=>setConfirm('published')}/><TextButton title={t('cms.archive')} disabled={busy} onPress={()=>setConfirm('archived')}/>{record?<TextButton title={t('common.delete')} disabled={busy} color={Colors.error} onPress={()=>setConfirm('delete')}/>:null}<TextButton title={t('cms.reload')} disabled={busy} onPress={()=>setConfirm('reload')}/></View>
  <Modal visible={preview} onRequestClose={()=>setPreview(false)} animationType="slide"><ScrollView contentContainerStyle={styles.content}><TextButton title={t('common.back')} onPress={()=>setPreview(false)}/><Text style={styles.note}>{t('cms.previewLanguage',{language:t(`cms.languages.${language}`)})}</Text>{cover?<ArticleImage path={cover} label={tr.title}/>:null}<Text style={styles.title}>{tr.title}</Text><Text style={styles.note}>{tr.summary}</Text><ArticleMarkdown content={tr.content}/><Text style={styles.label}>{tr.source_name}</Text><Text style={styles.note}>{tr.source_url}</Text></ScrollView></Modal>
  <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={()=>{if(!lock.current)setConfirm(null);}}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.title}>{t(confirm==='delete'?'cms.confirmDelete':confirm==='reload'?'cms.confirmReload':confirm==='published'?'cms.confirmPublish':'cms.confirmStatus')}</Text>{confirm==='published'?<Text style={styles.note}>{t('cms.missingTranslationHint')}</Text>:null}<PrimaryButton title={t('cms.confirm')} loading={busy} onPress={()=>confirm==='delete'?remove():confirm==='reload'?(setConfirm(null),reload()):confirm?save(confirm):undefined}/><TextButton title={t('common.cancel')} disabled={busy} onPress={()=>setConfirm(null)}/></View></View></Modal>
 </ScrollView>;
}
const baseStyles=StyleSheet.create({content:{padding:24,paddingBottom:60,gap:14,maxWidth:1100,width:'100%',alignSelf:'center',backgroundColor:Colors.background},title:{fontSize:26,lineHeight:34,fontWeight:'700',color:Colors.textPrimary},note:{fontSize:14,lineHeight:22,color:Colors.textSecondary},label:{fontSize:16,fontWeight:'600',color:Colors.textPrimary},row:{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'center'},input:{padding:14,borderWidth:1,borderColor:Colors.border,borderRadius:12,backgroundColor:Colors.surface,fontSize:16,lineHeight:24,color:Colors.textPrimary,minHeight:48},field:{gap:8},error:{color:Colors.error,fontSize:16},overlay:{flex:1,backgroundColor:Colors.overlay,justifyContent:'center',alignItems:'center',padding:24},dialog:{padding:24,gap:16,maxWidth:550,width:'100%',borderRadius:16,backgroundColor:Colors.surface}});
