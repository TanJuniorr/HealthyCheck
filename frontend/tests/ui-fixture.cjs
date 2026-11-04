/* global __dirname */
const path=require('node:path');
const createLoader=require('./load-ts.cjs');
// Small hook driver for exercising rendered event handlers with the project's Node test runner.
// Native controls are boundaries; business logic, translations and async handlers are real.
function uiFixture(extra={}, realAnalysis=false) {
 let slots=[];let cursor=0;const effects=[];
 const rootSlots=slots,componentSlots=new Map();
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...require('react'),
  useState(initial){const i=cursor++,state=slots;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
  useMemo(fn,deps){return hooks.useCallback(fn,deps)();},
  useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++,state=slots;if(!state[i]||!same(state[i].deps,deps)){const previous=state[i];state[i]={deps};effects.push(()=>{previous?.cleanup?.();state[i].cleanup=fn();});}}
 };
 const loader=createLoader({react:hooks,'@expo/vector-icons':{Ionicons:'Ionicons',MaterialCommunityIcons:'MaterialCommunityIcons'},
  ...(!extra.__realRecommendations?{[path.resolve(__dirname,'../src/components/health/HealthRecommendationsSection.tsx')]:{HealthRecommendationsSection:'HealthRecommendationsSection'}}:{}),
  [path.resolve(__dirname,'../src/hooks/useLocalToday.ts')]:{useLocalToday:()=>createLoader()('src/lib/dateUtils').toLocalDateKey()},
  [path.resolve(__dirname,'../src/components/health/SleepScheduleCard.tsx')]:{SleepScheduleCard:'SleepScheduleCard'},
  [path.resolve(__dirname,'../src/components/articles/ArticleImage.tsx')]:{ArticleImage:'ArticleImage'},
  [path.resolve(__dirname,'../src/contexts/ThemeContext.tsx')]:{useThemedStyles:styles=>styles,useTheme:()=>({isDark:false})},
  ...(!realAnalysis ? {[path.resolve(__dirname,'../src/components/health/SleepAnalysis.tsx')]:{SleepAnalysis:'SleepAnalysis'}} : {}),'react-native':{Keyboard:{dismiss(){}},useWindowDimensions:()=>extra.__dimensions??({width:390,height:844}),Image:'Image',Switch:'Switch',View:'View',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',Modal:'Modal',KeyboardAvoidingView:'KeyboardAvoidingView',ScrollView:'ScrollView',Platform:{OS:'web',select:()=>undefined},StyleSheet:{create:x=>x}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
  'react-i18next':{...require('react-i18next'),useTranslation:()=>({i18n:loader('src/i18n/index').default,t:(...args)=>loader('src/i18n/index').default.t(...args)})},
  [path.resolve(__dirname,'../src/services/sleepService.ts')]:{addSleepRecord:async()=>{},updateSleepRecord:async()=>{}},
  [path.resolve(__dirname,'../src/components/health/SleepDateTimeField.tsx')]:{SleepDateTimeField:'SleepDateTimeField'},
  [path.resolve(__dirname,'../src/components/common/Buttons.tsx')]:{PrimaryButton:'PrimaryButton',TextButton:'TextButton'},
  ...extra});
 function flushEffects(){while(effects.length)effects.shift()();}
 // Render real composed components with independent hook scopes. Native controls
 // remain inert boundaries, so these tests do not claim device/browser coverage.
 function renderDeep(fn){
  slots=rootSlots;cursor=0;const root=fn(),visited=new Set();
  function resolve(node,location){
   if(Array.isArray(node))return node.map((child,i)=>resolve(child,location+':'+i));
   if(!node||typeof node!=='object'||!node.props)return node;
   const component=typeof node.type==='function'?node.type:typeof node.type?.type==='function'?node.type.type:null;
   if(component){
    const id=location+':'+(component.name??'component')+':'+(node.key??'');visited.add(id);
    if(!componentSlots.has(id))componentSlots.set(id,[]);
    const parentSlots=slots,parentCursor=cursor;slots=componentSlots.get(id);cursor=0;
    const rendered=component(node.props);slots=parentSlots;cursor=parentCursor;
    return resolve(rendered,id);
   }
   return {...node,props:{...node.props,children:resolve(node.props.children,location+':children')}};
  }
  const result=resolve(root,'root');
  for(const [id,state] of componentSlots)if(!visited.has(id)){for(const slot of state)slot?.cleanup?.();componentSlots.delete(id);}
  flushEffects();return result;
 }
 return {load:loader,render(fn){slots=rootSlots;cursor=0;const result=fn();flushEffects();return result;},renderDeep,unmount(){for(const state of [rootSlots,...componentSlots.values()])for(const slot of state)slot?.cleanup?.();}};
}
function elements(tree) {
 if(!tree||typeof tree!=='object')return [];
 return [tree,...(Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children]).flat(Infinity).flatMap(elements)];
}

module.exports={uiFixture,elements};
