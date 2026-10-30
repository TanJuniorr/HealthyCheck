import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Slot,Redirect,router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../src/contexts/AuthContext';
import {useArticleRole} from '../../src/contexts/ArticleRoleContext';
import {useThemedStyles} from '../../src/contexts/ThemeContext';
import {Colors} from '../../src/constants/colors';
import {TextButton} from '../../src/components/common/Buttons';
import {DataFeedback} from '../../src/components/common/DataFeedback';

export default function AdminLayout(){
 const auth=useAuth(),role=useArticleRole(),{t}=useTranslation(),styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets();
 if(auth.isRecovery)return <Redirect href="/reset-password"/>;
 if(!auth.isLoading&&!auth.user)return <Redirect href="/login"/>;
 if((auth.isLoading||role.isLoading||role.error)&&!role.lastVerifiedAdmin)return <View style={[styles.screen,{paddingTop:insets.top+24,paddingHorizontal:24}]}><DataFeedback {...role} isLoading={auth.isLoading||role.isLoading}/></View>;
 if(role.data!=='admin'&&!(role.error&&role.lastVerifiedAdmin))return <View style={[styles.screen,{paddingTop:insets.top+24,paddingHorizontal:24}]}><Text accessibilityRole="alert" style={styles.title}>{t('cms.denied')}</Text><TextButton title={t('navigation.explore')} onPress={()=>router.replace('/(tabs)/explore')}/></View>;
 return <View style={[styles.screen,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
  <View style={styles.bar}><Text style={styles.title}>{t('cms.admin')}</Text><TextButton title={t('navigation.explore')} onPress={()=>router.replace('/(tabs)/explore')}/></View>
  {role.error?<DataFeedback {...role}/>:null}
  <View style={{flex:1,display:role.error?'none':'flex'}}><Slot key={auth.user!.id}/></View>
 </View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},bar:{paddingHorizontal:20,paddingVertical:8,gap:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',borderBottomWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},title:{color:Colors.textPrimary,fontWeight:'700',fontSize:20}});
