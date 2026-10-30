import React,{useRef,useState} from 'react';
import {View,Text,ScrollView,StyleSheet,Platform,Switch} from 'react-native';
import {Slot,Redirect,router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../src/contexts/AuthContext';
import {useTheme,useThemedStyles} from '../../src/contexts/ThemeContext';
import {useHealthQuery} from '../../src/hooks/useHealthQuery';
import {getArticleRole} from '../../src/services/articlesService';
import {authErrorMessage} from '../../src/lib/authErrors';
import {localizeMessage} from '../../src/i18n/localize';
import {Colors} from '../../src/constants/colors';
import {LanguageSelector} from '../../src/components/common/LanguageSelector';
import {AppTextInput} from '../../src/components/common/AppTextInput';
import {PrimaryButton,TextButton} from '../../src/components/common/Buttons';
import {DataFeedback} from '../../src/components/common/DataFeedback';
export default function AdminLayout(){
 const auth=useAuth(),{t}=useTranslation(),{isDark,setDarkMode}=useTheme(),styles=useThemedStyles(baseStyles);
 const role=useHealthQuery(getArticleRole,'article-admin-role'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),lock=useRef(false);
 const login=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{await auth.signIn(email.trim(),password);setPassword('');}catch(e){setError(authErrorMessage(e));}finally{lock.current=false;setBusy(false);}};
 if(auth.isRecovery)return <Redirect href="/reset-password"/>;
 return <View style={styles.screen}><View style={styles.bar}><Text style={styles.title}>{t('cms.admin')}</Text><LanguageSelector compact/><View style={styles.theme}><Text style={styles.text}>{t('cms.darkMode')}</Text><Switch accessibilityLabel={t('cms.darkMode')} value={isDark} onValueChange={setDarkMode}/></View>{auth.user?<TextButton title={t('auth.signOut')} onPress={async()=>{try{await auth.signOut();}catch(e){setError(authErrorMessage(e));}}}/>:null}</View>
  {error?<Text style={styles.error} accessibilityRole="alert">{localizeMessage(error)}</Text>:null}
  {Platform.OS!=='web'?<Text style={styles.text}>{t('cms.webOnly')}</Text>:!auth.user?<ScrollView contentContainerStyle={styles.login}><Text accessibilityRole="header" style={styles.title}>{t('cms.adminLogin')}</Text><AppTextInput label={t('auth.email')} keyboardType="email-address" value={email} onChangeText={setEmail}/><AppTextInput label={t('auth.password')} secureTextEntry value={password} onChangeText={setPassword}/><PrimaryButton title={t('auth.signIn')} loading={busy} onPress={login}/><TextButton title={t('auth.forgotLink')} onPress={()=>router.push('/forgot-password')}/></ScrollView>:role.isLoading||role.error?<View style={styles.login}><DataFeedback {...role}/></View>:role.data!=='admin'?<View style={styles.login}><Text accessibilityRole="alert" style={styles.title}>{t('cms.denied')}</Text></View>:<><View style={styles.nav}><TextButton title={t('cms.dashboard')} onPress={()=>router.push('/admin')}/><TextButton title={t('cms.categories')} onPress={()=>router.push('/admin/categories')}/><TextButton title={t('navigation.explore')} onPress={()=>router.push('/(tabs)/explore')}/></View><Slot key={auth.user.id}/></>}
 </View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},bar:{padding:16,gap:16,flexDirection:'row',alignItems:'center',flexWrap:'wrap',borderBottomWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},title:{color:Colors.textPrimary,fontWeight:'700',fontSize:24},text:{color:Colors.textPrimary,fontSize:16},theme:{flexDirection:'row',gap:12,alignItems:'center'},nav:{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:20},login:{padding:24,width:'100%',maxWidth:500,alignSelf:'center',gap:16},error:{color:Colors.error,padding:16}});
