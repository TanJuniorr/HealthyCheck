import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './resources/en.json';
import vi from './resources/vi.json';
const i18n = createInstance();
const initialization = i18n.use(initReactI18next).init({
 resources:{ en:{ translation:en },vi:{ translation:vi } },lng:'en',fallbackLng:'en',
 supportedLngs:['en','vi'],load:'languageOnly',returnNull:false,returnEmptyString:false,
 interpolation:{ escapeValue:false },react:{ useSuspense:false },
});
export { initialization, en, vi };
export default i18n;
