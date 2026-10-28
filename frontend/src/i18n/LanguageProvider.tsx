import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { initialization } from './index';
import { isAppLanguage, persistLanguage, readLanguage, type AppLanguage } from './languageStorage';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
type LanguageContextValue = { changeLanguage:(language:AppLanguage)=>Promise<void>; persistenceError:boolean };
const LanguageContext = createContext<LanguageContextValue | null>(null);
let bootstrap: Promise<void> | null = null;
function initializeLanguage() {
 if (!bootstrap) bootstrap = (async () => {
  await initialization;
  let deviceLanguage: string | null = null;
  try { deviceLanguage = getLocales()[0]?.languageCode ?? null; } catch { /* English fallback. */ }
  await i18n.changeLanguage(await readLanguage(deviceLanguage));
 })();
 return bootstrap;
}
export function LanguageProvider({ children }: React.PropsWithChildren) {
  useTheme();
 const selection = useRef(0);
 const [ready,setReady] = useState(false);
 const [persistenceError,setPersistenceError] = useState(false);
 const changeLanguage = useCallback(async (language: AppLanguage) => {
  if (!isAppLanguage(language)) return;
  const request = ++selection.current;
  await i18n.changeLanguage(language);
  setPersistenceError(false);
  try { await persistLanguage(language); if (selection.current === request) setPersistenceError(false); } catch { if (selection.current === request) setPersistenceError(true); }
 },[]);
 useEffect(() => { let active = true; void initializeLanguage().catch(async () => { await i18n.changeLanguage('en'); }).finally(() => { if (active) setReady(true); }); return () => { active=false; }; },[]);
 useEffect(() => {
  const update = () => { if (typeof document !== 'undefined') document.documentElement.lang = i18n.resolvedLanguage === 'vi' ? 'vi' : 'en'; };
  update(); i18n.on('languageChanged',update); return () => { i18n.off('languageChanged',update); };
 },[]);
 return <I18nextProvider i18n={i18n}><LanguageContext.Provider value={{ changeLanguage,persistenceError }}>
  {ready ? children : <View style={{ flex:1,alignItems:'center',justifyContent:'center',backgroundColor:Colors.background }}><ActivityIndicator color={Colors.primary} /></View>}
 </LanguageContext.Provider></I18nextProvider>;
}
export function useAppLanguage() {
 const context = useContext(LanguageContext);
 const { i18n:instance } = useTranslation();
 if (!context) throw new Error('useAppLanguage requires LanguageProvider');
 const language:AppLanguage = instance.resolvedLanguage === 'vi' ? 'vi' : 'en';
 return { ...context,language };
}
