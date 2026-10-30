import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDatePicker } from '../common/CalendarDatePicker';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { formatDate } from '../../i18n/formatting';
import { toLocalDateKey } from '../../lib/dateUtils';
import { PROFILE_GENDERS } from '../../lib/healthOnboarding';
import type { ProfileGender } from '../../types/database';
export function BirthDateField({value,onChange,disabled=false,error}:{value:string;onChange:(value:string)=>void;disabled?:boolean;error?:string}) {
 const {t}=useTranslation(),styles=useThemedStyles(baseStyles),[open,setOpen]=useState(false);
 return <View style={styles.field}>
  <Text style={styles.label}>{t('profile.birthDate')}</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('profile.chooseBirthDate')} disabled={disabled} onPress={()=>setOpen(true)} style={styles.date}><Text style={styles.text}>{value?formatDate(value):t('profile.chooseBirthDate')}</Text></TouchableOpacity>
  {error&&<Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
  {open&&<CalendarDatePicker key={value||'empty'} visible date={value||toLocalDateKey()} maxDate={toLocalDateKey()} title={t('profile.chooseBirthDate')} onClose={()=>setOpen(false)} onSelect={date=>{if(!disabled){onChange(date);setOpen(false);}}}/>}
 </View>;
}
export function GenderField({value,onChange,disabled=false,error}:{value:ProfileGender|'';onChange:(value:ProfileGender)=>void;disabled?:boolean;error?:string}) {
 const {t}=useTranslation(),styles=useThemedStyles(baseStyles);
 return <View style={styles.field}><Text style={styles.label}>{t('health.gender')}</Text><View style={styles.choices}>{PROFILE_GENDERS.map(gender=><TouchableOpacity key={gender} accessibilityRole="radio" accessibilityLabel={t(`profile.genderOptions.${gender}`)} accessibilityState={{selected:value===gender,disabled}} disabled={disabled} onPress={()=>onChange(gender)} style={[styles.choice,value===gender&&styles.selected]}><Text style={styles.text}>{t(`profile.genderOptions.${gender}`)}</Text></TouchableOpacity>)}</View>{error&&<Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}</View>;
}
const baseStyles=StyleSheet.create({field:{gap:8},label:{fontSize:14,fontWeight:'600',color:Colors.textSecondary},text:{fontSize:15,color:Colors.textPrimary},date:{padding:16,borderRadius:12,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.white},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{paddingVertical:14,paddingHorizontal:16,borderRadius:12,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.white},selected:{borderColor:Colors.primary,backgroundColor:Colors.primaryLight},error:{fontSize:13,lineHeight:20,color:Colors.error}});
