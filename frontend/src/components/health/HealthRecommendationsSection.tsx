import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { useHealthGoals, useHealthRecommendations } from '../../hooks/healthHooks';
import { useLocalToday } from '../../hooks/useLocalToday';
import type { QueryState } from '../../hooks/useHealthQuery';
import type { HealthGoalRow } from '../../types/database';
import type { HealthRecommendations } from '../../services/healthRecommendationService';
import { applyHealthGoalRecommendation, saveManualHealthGoals, type GoalSaveContext } from '../../services/healthGoalSnapshotService';
import { EDITABLE_GOAL_KEYS, goalValues, recommendationValue, type RecommendationKind } from '../../lib/healthGoalEditing';
import { dataError } from '../../lib/dataErrors';
import { localizeMessage } from '../../i18n/localize';
import { formatNumber } from '../../i18n/formatting';
import { DataFeedback } from '../common/DataFeedback';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { HealthGoalsModal } from '../profile/ProfileEditModals';

const kinds:RecommendationKind[]=['calories','steps','water'];
const fields={calories:'daily_calories',steps:'daily_steps',water:'daily_water_ml'} as const;
type Props={kinds?:RecommendationKind[];actual?:Partial<Record<RecommendationKind,number|null>>;goalsQuery?:QueryState<HealthGoalRow|null>;onEditProfile?:()=>void};
type Recommendation=HealthRecommendations[RecommendationKind];
type Preview={context:GoalSaveContext;selected:RecommendationKind[];recommendations:Partial<HealthRecommendations>};

export function HealthRecommendationsSection(props:Props){const {user}=useAuth();return <RecommendationContent key={user?.id??'guest'} {...props}/>;}
function RecommendationContent(props:Props){
 const query=useHealthRecommendations(props.kinds??kinds);
 return props.goalsQuery?<RecommendationPanel {...props} goalsQuery={props.goalsQuery} query={query}/>:<WithGoals {...props} query={query}/>;
}
function WithGoals(props:Props&{query:QueryState<Partial<HealthRecommendations>>}){const date=useLocalToday(),goals=useHealthGoals(date);return <RecommendationPanel {...props} goalsQuery={goals}/>;}

export function RecommendationPanel({kinds:visible=kinds,actual={},goalsQuery,query,onEditProfile}:Props&{goalsQuery:QueryState<HealthGoalRow|null>;query:QueryState<Partial<HealthRecommendations>>}){
 const {t}=useTranslation(),{user}=useAuth(),styles=useThemedStyles(baseStyles),{width}=useWindowDimensions(),date=useLocalToday();
 const [detail,setDetail]=useState<RecommendationKind|null>(null),[preview,setPreview]=useState<Preview|null>(null),[editing,setEditing]=useState<GoalSaveContext|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const editProfile=onEditProfile??(()=>router.push({pathname:'/profile',params:{edit:'personal'}}));
 const context=():GoalSaveContext=>({ownerId:user!.id,expectedGoal:goalsQuery.data,date});
 const available=!query.isLoading&&!query.error&&query.data;
 const canChange=Boolean(user)&&!goalsQuery.isLoading&&!goalsQuery.error&&!busy;
 const eligible=visible.filter(kind=>{const value=recommendationValue(kind,query.data?.[kind]);return kind!=='water'&&value!==null&&value!==goalsQuery.data?.[fields[kind]];});
 const openApply=(selected:RecommendationKind[])=>{if(!canChange||!available||lock.current)return;setError('');setNotice('');setPreview({context:context(),selected,recommendations:available});};
 const save=async()=>{
  if(!preview||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await applyHealthGoalRecommendation(preview.context,preview.selected,preview.recommendations);if(mounted.current){setPreview(null);setNotice('goals.saved');}}
  catch(failure){if(mounted.current)setError(dataError(failure).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const units=(kind:RecommendationKind)=>kind==='calories'?'kcal':kind==='water'?'ml':t('units.steps');
 const explain=(kind:RecommendationKind,result:Recommendation)=>kind==='calories'
  ?result.status==='success'?t('goals.calorieMethod'):result.status==='query_error'?localizeMessage(result.error.message):t(`goals.calorieReasons.${result.reason}`)
  :'explanationKey' in result?t(result.explanationKey):result.status==='query_error'?localizeMessage(result.error.message):'';
 return <View style={styles.section}>
  <Text accessibilityRole="header" style={styles.title}>{t('goals.forYou')}</Text><Text style={styles.text}>{t('goals.intro')}</Text>
  <DataFeedback {...query}/><DataFeedback {...goalsQuery}/>
  {!goalsQuery.isLoading&&!goalsQuery.error&&!goalsQuery.data?<Text style={styles.text}>{t('goals.completeFirst')}</Text>:null}
  {notice?<Text accessibilityRole="alert" style={styles.success}>{t(notice)}</Text>:null}
  <View style={styles.grid}>
   {visible.map(kind=>{
    const result=available?available[kind]:null,value=recommendationValue(kind,result),saved=goalsQuery.data?.[fields[kind]]??null,done=actual[kind];
    const percent=saved!==null&&saved>0&&done!=null?Math.max(0,Math.min(100,done/saved*100)):null;
    return <View key={kind} testID={`recommendation-${kind}`} style={[styles.card,{width:visible.length>1&&width>=1100?'31.8%':'100%',minWidth:width>=1100?240:0,flexGrow:1}]}>
     <View style={styles.heading}><Text style={styles.cardTitle}>{t(`goals.kinds.${kind}`)}</Text>{result?<Text style={styles.badge}>{t(`goals.status.${result.status}`)}</Text>:null}</View>
     <Text style={styles.label}>{t(kind==='water'?'goals.fluidEstimate':'goals.recommended')}</Text>
     <Text style={styles.value}>{value===null?'—':formatNumber(value,0)} <Text style={styles.unit}>{units(kind)}{t('goals.perDay')}</Text></Text>
     {result?.status==='success'?<Text style={styles.text}>{t(kind==='calories'?'goals.calorieMethod':kind==='water'?'goals.fluidMethod':'recommendationMethod' in result&&result.recommendationMethod==='verified_history_progression'?'goals.historyMethod':'goals.startMethod')}{kind==='steps'?` · ${t('confidence' in result&&result.confidence==='low'?'goals.lowConfidence':'goals.moderateConfidence')}`:''}</Text>:result?<Text style={styles.text}>{explain(kind,result)}</Text>:null}
     {kind==='water'?<Text style={styles.text}>{t('goals.waterScope')}</Text>:null}
     <View style={styles.saved}><Text style={styles.label}>{t(kind==='water'?'goals.trackedWaterGoal':'goals.current')}</Text><Text style={styles.savedValue}>{formatNumber(saved,0)} {units(kind)}</Text></View>
     {done!==undefined?<Text style={styles.text}>{t(`goals.actual.${kind}`,{value:formatNumber(done,0),unit:units(kind)})}</Text>:null}
     {percent!==null?<View accessibilityRole="progressbar" accessibilityLabel={t('goals.savedProgress')} accessibilityValue={{min:0,max:100,now:percent}} style={styles.track}><View style={[styles.fill,{width:`${percent}%`}]}/></View>:null}
     {result?<TextButton title={t('goals.details')} onPress={()=>setDetail(kind)}/>:null}
     {result?.status==='missing_data'?<TextButton title={t('goals.completeProfile')} onPress={editProfile}/>:null}
     {result?.status==='query_error'?<TextButton title={t('common.retry')} disabled={query.isLoading} onPress={query.refresh}/>:null}
     {kind!=='water'&&value!==null?<PrimaryButton title={t(saved===value?'goals.alreadyCurrent':'goals.applyValue',{value:formatNumber(value,0),unit:units(kind)})} disabled={!canChange||saved===value} onPress={()=>openApply([kind])}/>:null}
     <TextButton title={t(kind==='water'?'goals.editWater':'goals.editManually')} disabled={!canChange} onPress={()=>{if(canChange&&!lock.current){setNotice('');setEditing(context());}}}/>
    </View>;
   })}
  </View>
  {eligible.length>1?<TextButton title={t('goals.applyEligible')} disabled={!canChange||!available} onPress={()=>openApply(eligible)}/>:null}
  {goalsQuery.data?.target_sleep_minutes!=null?<Text style={styles.text}>{t('goals.sleepPreserved',{value:formatNumber(goalsQuery.data.target_sleep_minutes)})}</Text>:null}
  <Text style={styles.note}>{t('goals.estimateNotice')}</Text>
  {editing?<HealthGoalsModal key={editing.ownerId+':'+(editing.expectedGoal?.id??'new')} visible initial={goalValues(editing.expectedGoal)??{}} onClose={()=>setEditing(null)} onSave={async values=>{
   const changes=Object.fromEntries(EDITABLE_GOAL_KEYS.filter(key=>values[key]!==editing.expectedGoal?.[key]).map(key=>[key,values[key]]));
   if(Object.keys(changes).length)await saveManualHealthGoals(editing,changes);
   if(mounted.current)setNotice('goals.saved');
  }}/>:null}
  {detail&&available?<Modal transparent visible animationType="fade" onRequestClose={()=>setDetail(null)}><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}><ScrollView contentContainerStyle={styles.dialogContent}>
   <Text accessibilityRole="header" style={styles.cardTitle}>{t(`goals.kinds.${detail}`)}</Text><Text style={styles.text}>{explain(detail,available[detail]!)}</Text>
   {detail==='calories'&&available.calories?.status==='success'?<Text style={styles.text}>{t('goals.energyEstimates',{bmr:formatNumber(available.calories.bmr,0),tdee:formatNumber(available.calories.tdee,0)})}</Text>:null}
   {detail==='water'?<Text style={styles.text}>{t('goals.waterScope')}</Text>:null}<Text style={styles.text}>{t('goals.estimateNotice')}</Text><TextButton title={t('common.done')} onPress={()=>setDetail(null)}/>
  </ScrollView></View></View></Modal>:null}
  {preview?<Modal transparent visible animationType="fade" onRequestClose={()=>{if(!lock.current)setPreview(null);}}><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}><ScrollView contentContainerStyle={styles.dialogContent}>
   <Text accessibilityRole="header" style={styles.cardTitle}>{t('goals.confirmTitle')}</Text><Text style={styles.text}>{t('goals.confirmBody')}</Text>
   {preview.selected.map(kind=><Text key={kind} style={styles.text}>{t(`goals.kinds.${kind}`)}: {formatNumber(preview.context.expectedGoal?.[fields[kind]],0)} → {formatNumber(recommendationValue(kind,preview.recommendations[kind]),0)} {units(kind)}</Text>)}
   <Text style={styles.text}>{t('goals.unchanged',{fields:EDITABLE_GOAL_KEYS.filter(key=>!preview.selected.some(kind=>fields[kind]===key)).map(key=>`${t(`fields.${key}`)}: ${formatNumber(preview.context.expectedGoal?.[key],0)}`).join(', ')})}</Text>
   {!preview.context.expectedGoal?<Text style={styles.text}>{t('goals.completeFirst')}</Text>:null}
   {error?<Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text>:null}
   <PrimaryButton title={t('goals.confirmApply')} disabled={!preview.context.expectedGoal} loading={busy} onPress={save}/><TextButton title={t('common.cancel')} disabled={busy} onPress={()=>setPreview(null)}/>
  </ScrollView></View></View></Modal>:null}
 </View>;
}
const baseStyles=StyleSheet.create({section:{gap:12,marginVertical:20},title:{fontSize:21,fontWeight:'700',color:Colors.textPrimary},text:{fontSize:14,lineHeight:21,color:Colors.textSecondary,flexShrink:1},note:{fontSize:12,lineHeight:18,color:Colors.textSecondary},grid:{flexDirection:'row',flexWrap:'wrap',gap:14},card:{backgroundColor:Colors.white,borderWidth:1,borderColor:Colors.border,borderRadius:20,padding:18,gap:10},heading:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},cardTitle:{fontSize:18,fontWeight:'700',color:Colors.textPrimary},badge:{fontSize:12,color:Colors.primary,fontWeight:'600'},label:{fontSize:13,color:Colors.textSecondary},value:{fontSize:27,fontWeight:'800',color:Colors.primary},unit:{fontSize:13,fontWeight:'500',color:Colors.textSecondary},saved:{paddingTop:10,borderTopWidth:1,borderTopColor:Colors.border,gap:4},savedValue:{fontSize:18,fontWeight:'600',color:Colors.textPrimary},track:{height:8,borderRadius:4,backgroundColor:Colors.border,overflow:'hidden'},fill:{height:8,backgroundColor:Colors.primary},success:{color:Colors.success},error:{color:Colors.error,fontSize:14,lineHeight:21},backdrop:{flex:1,alignItems:'center',justifyContent:'center',padding:20,backgroundColor:'rgba(0,0,0,0.45)'},dialog:{width:'100%',maxWidth:560,maxHeight:'85%',backgroundColor:Colors.white,borderRadius:20},dialogContent:{padding:22,gap:18}});
