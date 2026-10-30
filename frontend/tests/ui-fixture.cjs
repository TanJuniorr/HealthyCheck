/* global __dirname */
const path=require('node:path');
const createLoader=require('./load-ts.cjs');
// Small hook driver for exercising rendered event handlers with the project's Node test runner.
// Native controls are boundaries; business logic, translations and async handlers are real.
function uiFixture(extra={}, realAnalysis=false) {
 const slots=[];let cursor=0;const effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...require('react'),
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useMemo(fn,deps){return hooks.useCallback(fn,deps)();},
  useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}}
 };
 const loader=createLoader({react:hooks,'@expo/vector-icons':{Ionicons:'Ionicons'},
  [path.resolve(__dirname,'../src/components/health/SleepScheduleCard.tsx')]:{SleepScheduleCard:'SleepScheduleCard'},
  [path.resolve(__dirname,'../src/contexts/ThemeContext.tsx')]:{useThemedStyles:styles=>styles,useTheme:()=>({isDark:false})},
  ...(!realAnalysis ? {[path.resolve(__dirname,'../src/components/health/SleepAnalysis.tsx')]:{SleepAnalysis:'SleepAnalysis'}} : {}),'react-native':{View:'View',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',Modal:'Modal',KeyboardAvoidingView:'KeyboardAvoidingView',ScrollView:'ScrollView',Platform:{OS:'web',select:()=>undefined},StyleSheet:{create:x=>x}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
  'react-i18next':{...require('react-i18next'),useTranslation:()=>({i18n:loader('src/i18n/index').default,t:(...args)=>loader('src/i18n/index').default.t(...args)})},
  [path.resolve(__dirname,'../src/services/sleepService.ts')]:{addSleepRecord:async()=>{},updateSleepRecord:async()=>{}},
  [path.resolve(__dirname,'../src/components/health/SleepDateTimeField.tsx')]:{SleepDateTimeField:'SleepDateTimeField'},
  [path.resolve(__dirname,'../src/components/common/Buttons.tsx')]:{PrimaryButton:'PrimaryButton',TextButton:'TextButton'},
  ...extra});
 return {load:loader,render(fn){cursor=0;const result=fn();while(effects.length)effects.shift()();return result;},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}
function elements(tree) {
 if(!tree||typeof tree!=='object')return [];
 return [tree,...(Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children]).flat(Infinity).flatMap(elements)];
}

module.exports={uiFixture,elements};
