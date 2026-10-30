import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { FoodRow } from '../../types/database';
import { foodName, pieceWeight, portionGrams, portionText, portionUnitKey, type PortionUnit } from '../../lib/foodPortions';
import { calculateFoodNutrition } from '../../lib/healthCalculations';
import { dataError } from '../../lib/dataErrors';
import { localizeMessage } from '../../i18n/localize';
import { formatNumber } from '../../i18n/formatting';
import { AppTextInput } from '../common/AppTextInput';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
type Props = { food: FoodRow; grams: number; onSave: (grams: number) => Promise<void> | void; onClose: () => void };
export function FoodPortionForm({ food, grams: initial, onSave, onClose }: Props) {
 const { t, i18n } = useTranslation(), styles = useThemedStyles(baseStyles), insets = useSafeAreaInsets();
 const [grams,setGrams] = useState<number|null>(initial), [text,setText] = useState(String(initial)), [unit,setUnit] = useState<PortionUnit>('g');
 const [busy,setBusy] = useState(false), [error,setError] = useState<string|null>(null);
 const lock = useRef(false), mounted = useRef(true);
 useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; },[]);
 const weight = pieceWeight(food), name = foodName(food,i18n.resolvedLanguage ?? 'vi');
 const nutrition = grams === null ? null : calculateFoodNutrition(food,grams);
 const switchUnit = (next: PortionUnit) => {
  if(lock.current || grams === null)return;
  setUnit(next); setText(portionText(food,grams,next));
 };
 const close = () => { if(!lock.current)onClose(); };
 const save = async () => {
  if(lock.current || grams === null)return;
  lock.current=true;setBusy(true);setError(null);
  try { await onSave(grams); if(mounted.current)onClose(); }
  catch(e) { if(mounted.current)setError(dataError(e).message); }
  finally { lock.current=false;if(mounted.current)setBusy(false); }
 };
 return <Modal visible animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+20}]}>
  <Text accessibilityRole="header" style={styles.title}>{name}</Text>
  <Text style={styles.text}>{t('meals.calorieReference',{value:formatNumber(food.calories_per_100g)})}</Text>
  <View style={styles.row}><TextButton title={t('meals.unitGram')} disabled={busy || grams===null} onPress={()=>switchUnit('g')}/>{weight!==null && <TextButton title={t(portionUnitKey(food))} disabled={busy || grams===null} onPress={()=>switchUnit('piece')}/>}</View>
  <AppTextInput label={t(unit==='g'?(food.catalog_metadata?.edible_portion?'meals.edibleWeight':'meals.quantityGram'):food.catalog_metadata?.unit_kind==='slice'?'meals.quantitySlice':'meals.quantityPiece')} keyboardType="decimal-pad" editable={!busy} value={text} onChangeText={value=>{setText(value);setGrams(portionGrams(food,value,unit));}}/>
  {grams===null && <Text accessibilityRole="alert" style={styles.error}>{t('meals.invalidPortion')}</Text>}
  {weight!==null && <Text style={styles.text}>{t(food.catalog_metadata?.unit_kind==='slice'?'meals.sliceEstimate':'meals.pieceEstimate',{weight:formatNumber(weight)})} · {t('meals.referencePortion')}: {i18n.resolvedLanguage==='vi'?food.catalog_metadata?.unit_description_vi??t('meals.sourcePortion'):food.catalog_metadata?.unit_description}</Text>}
  {food.catalog_metadata?.preparation_state==='cooked' && <Text style={styles.text}>{t('meals.cookedReference',{method:t(`meals.methods.${food.catalog_metadata.reference_method??'cooked'}`)})}</Text>}
  <Text style={styles.text}>{t('meals.canonicalGrams',{value:grams===null?'—':formatNumber(grams)})}</Text>
  <View style={styles.preview}>
   <Text style={styles.title}>{nutrition ? formatNumber(nutrition.calories,1) : '—'} kcal</Text>
   {(['protein','carbs','fat'] as const).map(key=><Text key={key} style={styles.text}>{t(`nutrition.${key}`)}: {nutrition ? formatNumber(nutrition[key],2) : '—'} g</Text>)}
  </View>
  {food.catalog_metadata?.source ? <Text selectable style={styles.text}>{t('meals.dataSource')}: {food.catalog_metadata.source} · {food.catalog_metadata.source_id}{'\n'}{food.catalog_metadata.source_url}</Text> : null}
  {food.catalog_metadata?.recipe_reference ? <Text style={styles.text}>{t('meals.recipeReference')}</Text> : null}
  {!food.catalog_metadata?.source_id && <Text style={styles.text}>{t('meals.unverifiedSource')}</Text>}
  {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
  <PrimaryButton title={t('common.save')} onPress={save} disabled={grams===null} loading={busy}/><TextButton title={t('common.cancel')} onPress={close} disabled={busy}/>
 </ScrollView></KeyboardAvoidingView></Modal>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{paddingHorizontal:20,gap:16,maxWidth:640,width:'100%',alignSelf:'center'},title:{color:Colors.textPrimary,fontSize:22,fontWeight:'700'},text:{color:Colors.textSecondary,fontSize:14,lineHeight:21},error:{color:Colors.error},row:{flexDirection:'row',flexWrap:'wrap',gap:4},preview:{padding:20,gap:10,backgroundColor:Colors.white,borderRadius:16}});
