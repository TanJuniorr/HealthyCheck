import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/contexts/AuthContext';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import { Colors } from '../src/constants/colors';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton, TextButton } from '../src/components/common/Buttons';
import { BirthDateField, GenderField } from '../src/components/profile/PersonalHealthFields';
import { LanguageSelector } from '../src/components/common/LanguageSelector';
import { ageFromBirthDate, healthDecimal, onboardingErrors, type HealthOnboardingDraft } from '../src/lib/healthOnboarding';
import { dataError } from '../src/lib/dataErrors';
import { authErrorMessage } from '../src/lib/authErrors';
import { localizeMessage } from '../src/i18n/localize';
import { formatNumber } from '../src/i18n/formatting';
export default function HealthOnboardingScreen() {
 const {user}=useAuth();return user?<HealthOnboardingForm key={user.id}/>:null;
}
export function HealthOnboardingForm() {
 const {profile,finishHealthOnboarding,signOut}=useAuth(),{t}=useTranslation(),styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets();
 const [draft,setDraft]=useState<HealthOnboardingDraft>({dateOfBirth:profile?.date_of_birth??'',gender:profile?.gender??'',heightCm:profile?.height_cm==null?'':String(profile.height_cm),weightKg:''});
 const [step,setStep]=useState(1),[touched,setTouched]=useState<Partial<Record<keyof HealthOnboardingDraft,boolean>>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const errors=onboardingErrors(draft),age=ageFromBirthDate(draft.dateOfBirth),complete=Object.keys(errors).length===0;
 const change=<K extends keyof HealthOnboardingDraft>(key:K,value:HealthOnboardingDraft[K])=>{if(!lock.current){setDraft(previous=>({...previous,[key]:value}));setTouched(previous=>({...previous,[key]:true}));setError('');}};
 const next=()=>{setTouched(previous=>({...previous,dateOfBirth:true,gender:true}));if(!errors.dateOfBirth&&!errors.gender)setStep(2);};
 const save=async()=>{
  if(lock.current)return;setTouched({dateOfBirth:true,gender:true,heightCm:true,weightKg:true});if(!complete)return;
  lock.current=true;setBusy(true);setError('');
  try{await finishHealthOnboarding({date_of_birth:draft.dateOfBirth,gender:draft.gender as Exclude<HealthOnboardingDraft['gender'],''>,height_cm:healthDecimal(draft.heightCm)!,weight_kg:healthDecimal(draft.weightKg)!});}
  catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const logout=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await signOut();}catch(e){if(mounted.current)setError(authErrorMessage(e));}finally{lock.current=false;if(mounted.current)setBusy(false);}};
 return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{paddingTop:insets.top+24,paddingBottom:insets.bottom+24}]}>
  <Text style={styles.brand}>HealthyCheck</Text><Text accessibilityRole="header" style={styles.title}>{t('onboarding.title')}</Text><Text style={styles.text}>{t('onboarding.description')}</Text>
  <Text style={styles.progress}>{t('onboarding.step',{step:formatNumber(step),total:formatNumber(2)})}</Text>
  <View style={styles.card}>
   <Text style={styles.section}>{t(step===1?'onboarding.personalStep':'onboarding.bodyStep')}</Text>
   {step===1?<>
    <BirthDateField value={draft.dateOfBirth} onChange={value=>change('dateOfBirth',value)} disabled={busy} error={touched.dateOfBirth?errors.dateOfBirth:undefined}/>
    {age!==null&&<Text style={styles.text}>{t('onboarding.age',{value:formatNumber(age)})}</Text>}
    <GenderField value={draft.gender} onChange={value=>change('gender',value)} disabled={busy} error={touched.gender?errors.gender:undefined}/>
   </>:<>
    <AppTextInput editable={!busy} label={t('onboarding.height')} keyboardType="decimal-pad" value={draft.heightCm} onChangeText={value=>change('heightCm',value)} error={touched.heightCm?errors.heightCm:undefined}/>
    <AppTextInput editable={!busy} label={t('onboarding.weight')} keyboardType="decimal-pad" value={draft.weightKg} onChangeText={value=>change('weightKg',value)} error={touched.weightKg?errors.weightKg:undefined}/>
    <Text style={styles.text}>{t('onboarding.weightHint')}</Text>
   </>}
   {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
   {step===1?<PrimaryButton title={t('common.continue')} disabled={busy} onPress={next}/>:<><PrimaryButton title={t('onboarding.finish')} loading={busy} disabled={!complete} onPress={save}/><TextButton title={t('common.back')} disabled={busy} onPress={()=>setStep(1)}/></>}
  </View>
  <LanguageSelector compact/><TextButton title={t('auth.signOut')} disabled={busy} onPress={logout}/>
 </ScrollView></KeyboardAvoidingView>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{width:'100%',maxWidth:600,alignSelf:'center',paddingHorizontal:24,gap:18},brand:{fontSize:18,fontWeight:'800',color:Colors.primary},title:{fontSize:28,lineHeight:35,fontWeight:'800',color:Colors.textPrimary},text:{fontSize:15,lineHeight:23,color:Colors.textSecondary},progress:{color:Colors.primary,fontWeight:'700'},section:{fontSize:19,fontWeight:'700',color:Colors.textPrimary},card:{padding:20,gap:20,borderRadius:20,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.white},error:{fontSize:14,lineHeight:21,color:Colors.error}});
