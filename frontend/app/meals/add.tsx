import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { AppHeader } from '../../src/components/common/AppHeader';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { FoodPortionForm } from '../../src/components/health/FoodPortionForm';
import { fetchFoods } from '../../src/lib/healthData';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { addMealItems, deleteMealRecord, getMealsByDateRange, updateMealRecord } from '../../src/services/mealsService';
import { calculateFoodNutrition } from '../../src/lib/healthCalculations';
import { FOOD_GROUPS, filterFoods, foodName, pieceWeight, type FoodGroup } from '../../src/lib/foodPortions';
import { safeNumber } from '../../src/lib/dataValidation';
import { dataError } from '../../src/lib/dataErrors';
import { formatDate, formatNumber, formatTime } from '../../src/i18n/formatting';
import { localizeMessage } from '../../src/i18n/localize';
import { parseLocalDate, toLocalDateKey } from '../../src/lib/dateUtils';
import type { FoodRow, MealType } from '../../src/types/database';
import type { MealWithFood } from '../../src/types/health';
const MEAL_TYPES: MealType[] = ['breakfast','lunch','dinner','snack'];
type Draft = { food: FoodRow; grams: number; mealType: MealType };
type Editor = { food: FoodRow; grams: number; mealType: MealType; record?: MealWithFood };
export default function AddMealScreen() {
 const { user } = useAuth();
 const params = useLocalSearchParams<{mealType?:string;date?:string}>();
 // Dispose drafts and open dialogs when the account or requested day changes.
 return user ? <MealEditor key={`${user.id}:${params.date ?? ''}`} date={params.date} mealType={params.mealType}/> : null;
}
export function MealEditor({date,mealType}:{date?:string;mealType?:string}) {
 const styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets(),{t,i18n}=useTranslation();
 const language=i18n.resolvedLanguage ?? 'vi';
 let mealDate=toLocalDateKey();try { if(date)mealDate=toLocalDateKey(date); }catch { /* Use today for an invalid route date. */ }
 const [selectedMealType,setSelectedMealType]=useState<MealType>(MEAL_TYPES.includes(mealType as MealType)?mealType as MealType:'dinner');
 const [search,setSearch]=useState(''),[group,setGroup]=useState<FoodGroup|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]),[editor,setEditor]=useState<Editor|null>(null),[deleting,setDeleting]=useState<MealWithFood|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false);
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const catalogue=useHealthQuery(fetchFoods,'food-catalogue');
 const existing=useHealthQuery(()=>getMealsByDateRange(mealDate,mealDate),'meal-editor:'+mealDate);
 const foods=useMemo(()=>filterFoods(catalogue.data??[],search,group),[catalogue.data,search,group]);
 const rows=(existing.data??[]).filter(row=>row.meal_type===selectedMealType);
 const total=drafts.reduce((sum,item)=>{
  const n=calculateFoodNutrition(item.food,item.grams);
  return {calories:sum.calories+n.calories,protein:sum.protein+n.protein,carbs:sum.carbs+n.carbs,fat:sum.fat+n.fat};
 },{calories:0,protein:0,carbs:0,fat:0});
 const openFood=(food:FoodRow)=>{
  if(lock.current)return;
  const draft=drafts.find(item=>item.food.id===food.id && item.mealType===selectedMealType);
  setEditor({food,grams:draft?.grams??100,mealType:selectedMealType});setError(null);setSaved(false);
 };
 const savePortion=async(grams:number)=>{
  if(!editor)return;
  if(editor.record){await updateMealRecord(editor.record.id,{quantity_g:grams});}
  else {const next={food:editor.food,grams,mealType:editor.mealType};setDrafts(previous=>[...previous.filter(item=>item.food.id!==next.food.id||item.mealType!==next.mealType),next]);}
 };
 const logMeal=async()=>{
  if(lock.current||!drafts.length)return;lock.current=true;setBusy(true);setError(null);setSaved(false);
  try {
   const consumedAt=mealDate===toLocalDateKey()?new Date():parseLocalDate(mealDate);if(mealDate!==toLocalDateKey())consumedAt.setHours(12,0,0,0);
   await addMealItems(drafts.map(item=>({food_id:item.food.id,quantity_g:item.grams,meal_type:item.mealType,consumed_at:consumedAt.toISOString()})));
   if(mounted.current){setDrafts([]);setSaved(true);}
  }catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const remove=async()=>{
  if(lock.current||!deleting)return;lock.current=true;setBusy(true);setError(null);
  try{await deleteMealRecord(deleting.id);if(mounted.current)setDeleting(null);}
  catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const rowLabel=(food:FoodRow,grams:number)=>`${foodName(food,language)} · ${formatNumber(grams)} g · ${formatNumber(calculateFoodNutrition(food,grams).calories,1)} kcal`;
 return <View style={styles.container}>
  <AppHeader title={t('meals.addMeal')} showBack/>
  <Text style={[styles.foodServing,{padding:12}]}>{formatDate(mealDate)}</Text>
  <View style={styles.mealTypeBar}>{MEAL_TYPES.map(type=><TouchableOpacity key={type} accessibilityRole="button" accessibilityState={{selected:type===selectedMealType,disabled:busy}} disabled={busy} onPress={()=>setSelectedMealType(type)} style={[styles.mealTypeTab,type===selectedMealType&&styles.mealTypeTabSelected]}><Text style={styles.mealTypeLabel}>{t(`meals.${type}`)}</Text></TouchableOpacity>)}</View>
  <View style={styles.searchSection}><View style={styles.searchBox}><Ionicons name="search-outline" size={20} color={Colors.textMuted}/><TextInput accessibilityLabel={t('meals.search')} style={styles.searchInput} placeholder={t('meals.search')} placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} autoCapitalize="none" clearButtonMode="while-editing"/></View></View>
  <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,gap:8,paddingVertical:8}}>{[null,...FOOD_GROUPS].map(value=><TouchableOpacity key={value??'all'} accessibilityRole="button" accessibilityState={{selected:group===value}} onPress={()=>setGroup(value)} style={[styles.mealTypeTab,group===value&&styles.mealTypeTabSelected]}><Text style={styles.mealTypeLabel}>{t(value?`meals.groups.${value}`:'meals.allGroups')}</Text></TouchableOpacity>)}</ScrollView></View>
  <FlatList data={foods} keyExtractor={item=>item.id} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={7} contentContainerStyle={[styles.listContent,{paddingBottom:20}]} extraData={[drafts,language,busy]}
   ListHeaderComponent={<View>
    <DataFeedback {...existing}/>
    {rows.length>0&&<Text style={styles.listSectionTitle}>{t('meals.savedItems')}</Text>}
    {rows.map(row=><View key={row.id} style={styles.foodRow}><View style={styles.foodInfo}><Text style={styles.foodName}>{row.food?rowLabel(row.food,safeNumber(row.quantity_g)):t('nutrition.unavailableFood')}</Text><Text style={styles.foodServing}>{formatTime(row.consumed_at)}</Text></View><TextButton title={t('common.edit')} disabled={busy||!row.food} onPress={()=>{if(row.food)setEditor({food:row.food,grams:safeNumber(row.quantity_g),mealType:row.meal_type,record:row});}}/><TextButton title={t('common.delete')} disabled={busy} color={Colors.error} onPress={()=>{setError(null);setDeleting(row);}}/></View>)}
    {drafts.length>0&&<Text style={styles.listSectionTitle}>{t('meals.totalSelected')}</Text>}
    {drafts.map(item=><View key={item.mealType+item.food.id} style={styles.foodRow}><TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.foodInfo} onPress={()=>setEditor({food:item.food,grams:item.grams,mealType:item.mealType})}><Text style={styles.foodName}>{rowLabel(item.food,item.grams)}</Text><Text style={styles.foodServing}>{t(`meals.${item.mealType}`)}</Text></TouchableOpacity><TextButton title={t('common.delete')} disabled={busy} color={Colors.error} onPress={()=>setDrafts(previous=>previous.filter(draft=>draft!==item))}/></View>)}
    <Text style={[styles.listSectionTitle,{marginVertical:12}]}>{t('meals.quickFoods')}</Text>
    {catalogue.isLoading||catalogue.error?<DataFeedback {...catalogue}/>:null}
   </View>}
   ListEmptyComponent={!catalogue.isLoading&&!catalogue.error?<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>{t('meals.emptySearch')}</Text><Text style={styles.emptySubtitle}>{t('meals.searchHint')}</Text></View>:undefined}
   renderItem={({item})=>{const selected=drafts.find(draft=>draft.food.id===item.id&&draft.mealType===selectedMealType);return <TouchableOpacity accessibilityRole="button" accessibilityLabel={foodName(item,language)} disabled={busy} onPress={()=>openFood(item)} style={[styles.foodRow,selected&&{borderColor:Colors.primary}]}><View style={styles.foodIconWrapper}><Ionicons name="nutrition-outline" size={20} color={Colors.orange}/></View><View style={styles.foodInfo}><Text style={styles.foodName}>{foodName(item,language)}</Text><Text style={styles.foodServing}>{t('meals.calorieReference',{value:formatNumber(item.calories_per_100g)})}</Text><Text style={styles.foodServing}>{t('meals.unitGram')}{pieceWeight(item)!==null?` · ${t('meals.unitPiece')}`:''}{selected?` · ${formatNumber(selected.grams)} g`:''}</Text></View><Ionicons name={selected?'checkmark-circle':'add-circle-outline'} size={24} color={Colors.primary}/></TouchableOpacity>;}}
  />
  <View style={[styles.bottomBar,{position:'relative',paddingBottom:Math.max(12,insets.bottom),gap:8}]}>
   {error ? <Text accessibilityRole="alert" style={{color:Colors.error}}>{localizeMessage(error)}</Text> : null}
   {saved&&<Text accessibilityRole="text" style={{color:Colors.primary}}>{t('meals.saved')}</Text>}
   <Text style={styles.summaryValue}>{formatNumber(total.calories,1)} kcal</Text>
   <Text style={styles.foodServing}>{(['protein','carbs','fat'] as const).map(key=>`${t(`nutrition.${key}`)} ${formatNumber(total[key],1)} g`).join(' · ')}</Text>
   <PrimaryButton title={t('meals.saveSelection',{count:drafts.length})} onPress={logMeal} loading={busy} disabled={!drafts.length || catalogue.isLoading || !existing.data || existing.isLoading || !!existing.error}/>
  </View>
  {editor&&<FoodPortionForm key={editor.record?.id??editor.mealType+editor.food.id} food={editor.food} grams={editor.grams} onSave={savePortion} onClose={()=>setEditor(null)}/>}
  {deleting ? <Modal visible transparent animationType="fade" onRequestClose={()=>{if(!lock.current)setDeleting(null);}}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:Colors.overlay}}><View style={[styles.foodRow,{flexDirection:'column',alignItems:'stretch',gap:12}]}><Text style={styles.foodName}>{t('meals.deleteConfirm')}</Text><Text style={styles.foodServing}>{deleting.food?rowLabel(deleting.food,safeNumber(deleting.quantity_g)):t('nutrition.unavailableFood')}</Text>{error ? <Text accessibilityRole="alert" style={{color:Colors.error}}>{localizeMessage(error)}</Text> : null}<PrimaryButton title={t('common.delete')} onPress={remove} loading={busy}/><TextButton title={t('common.cancel')} disabled={busy} onPress={()=>setDeleting(null)}/></View></View></Modal> : null}
 </View>;
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mealTypeBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  mealTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
    backgroundColor: Colors.background,
  },
  mealTypeTabSelected: {
    backgroundColor: Colors.primaryLight,
  },
  mealTypeLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  mealTypeLabelSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listSectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  itemCountText: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  foodIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  foodServing: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  foodCalories: {
    color: Colors.orange,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  addButtonText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAdd: {
    backgroundColor: Colors.primary,
  },
  stepperCount: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
    ...Shadows.lg,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  summaryValue: {
    ...Typography.cardTitle,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.orange,
  },
  summaryUnit: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  summaryCount: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  logButton: {
    minWidth: 150,
  },
});
