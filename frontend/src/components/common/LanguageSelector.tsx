import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import { Colors } from '../../constants/colors';
import { Radius,Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
 const { t } = useTranslation();
 const { language,changeLanguage,persistenceError } = useAppLanguage();
 return <View style={{ backgroundColor:Colors.surface,borderRadius:Radius.lg,borderWidth:compact ? 0 : 1,borderColor:Colors.border,paddingHorizontal:compact ? 0 : Spacing.lg,marginBottom:Spacing.lg }}>
  {!compact ? <Text style={{ ...Typography.supporting,color:Colors.textSecondary,paddingTop:Spacing.md }}>{t('settings.languageHint')}</Text> : null}
  <View style={compact ? { flexDirection:'row',justifyContent:'center',gap:Spacing.xl } : undefined} accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
   {([{ code:'en',name:'English' },{ code:'vi',name:'Tiếng Việt' }] as const).map(option => <TouchableOpacity key={option.code} accessibilityRole="radio" accessibilityLabel={option.name} accessibilityState={{ checked:language === option.code }} onPress={() => void changeLanguage(option.code)} style={{ minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.md }}>
    <Text style={{ ...Typography.body,color:Colors.textPrimary,flexShrink:1 }}>{option.name}</Text>
    <Ionicons name={language === option.code ? 'radio-button-on' : 'radio-button-off'} size={22} color={language === option.code ? Colors.primary : Colors.textMuted} />
   </TouchableOpacity>)}
  </View>
  {persistenceError ? <Text accessibilityRole="alert" style={{ ...Typography.supporting,color:Colors.error,paddingBottom:Spacing.md }}>{t('settings.languageSaveError')}</Text> : null}
 </View>;
}
