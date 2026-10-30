import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { Colors } from '../../src/constants/colors';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { authErrorMessage } from '../../src/lib/authErrors';
import { localizeMessage } from '../../src/i18n/localize';
export default function ProfileCheckScreen() {
 const {profileError,refreshProfile,signOut}=useAuth(),{t}=useTranslation(),styles=useThemedStyles(baseStyles);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const logout=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await signOut();}catch(e){setError(authErrorMessage(e));}finally{lock.current=false;setBusy(false);}};
 return <View style={styles.screen}><View style={styles.content}>
  <Text accessibilityRole="header" style={styles.title}>{t('onboarding.checkingProfile')}</Text>
  {profileError?<><Text accessibilityRole="alert" style={styles.error}>{localizeMessage(profileError)}</Text><PrimaryButton title={t('common.retry')} disabled={busy} onPress={refreshProfile}/></>:<ActivityIndicator accessibilityLabel={t('onboarding.checkingProfile')} color={Colors.primary}/>}
  {error&&<Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text>}
  <TextButton title={t('auth.signOut')} loading={busy} onPress={logout}/>
 </View></View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background,justifyContent:'center',padding:24},content:{width:'100%',maxWidth:520,alignSelf:'center',gap:20},title:{fontSize:24,fontWeight:'700',color:Colors.textPrimary},error:{color:Colors.error,lineHeight:22}});
