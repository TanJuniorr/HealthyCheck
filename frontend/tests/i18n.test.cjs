/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const createLoader = require('./load-ts.cjs');
const en = require('../src/i18n/resources/en.json');
const vi = require('../src/i18n/resources/vi.json');
const load = createLoader();
const { default:i18n,initialization } = load('src/i18n/index');
const formatting = load('src/i18n/formatting');
const { localizeStaticData,localizeMessage } = load('src/i18n/localize');
function flatten(object,prefix='') { return Object.entries(object).flatMap(([key,value]) => typeof value === 'string' ? [[prefix+key,value]] : flatten(value,prefix+key+'.')); }
function storageFixture(saved,failRead=false,failWrite=false) {
 const values = new Map([['@healthycheck:language',saved],['auth-session','untouched'],['health-data','untouched']]); const calls=[];
 const storage={ async getItem(key) {calls.push(['get',key]);if(failRead)throw Error('unavailable');return values.get(key)??null;},async setItem(key,value) {calls.push(['set',key,value]);if(failWrite)throw Error('unavailable');values.set(key,value);} };
 return { values,calls,storage,api:createLoader({'@react-native-async-storage/async-storage':storage})('src/i18n/languageStorage') };
}
test('English and Vietnamese resource keys and interpolation variables match',()=>{
 const english=flatten(en),vietnamese=new Map(flatten(vi));
 assert.deepEqual(english.map(([key])=>key).sort(),[...vietnamese.keys()].sort());
 for(const [key,value] of english) {
  assert.ok(value.trim(),key); assert.ok(vietnamese.get(key).trim(),key);
  const variables=text=>[...text.matchAll(/{{\s*([^},]+).*?}}/g)].map(match=>match[1]).sort();
  assert.deepEqual(variables(value),variables(vietnamese.get(key)),key);
 }
});
test('first launch detects Vietnamese and otherwise falls back to English',async()=>{
 const f=storageFixture(null);
 assert.equal(await f.api.readLanguage('vi'),'vi');assert.equal(await f.api.readLanguage('vi-VN'),'vi');
 assert.equal(await f.api.readLanguage('en-US'),'en');assert.equal(await f.api.readLanguage('fr-FR'),'en');
 assert.equal(await f.api.readLanguage(null),'en');
});
test('saved preference overrides device locale and survives unrelated session/data values',async()=>{
 const f=storageFixture('vi');
 assert.equal(await f.api.readLanguage('en'),'vi');
 await f.api.persistLanguage('en');assert.equal(await f.api.readLanguage('vi'),'en');
 assert.equal(f.values.get('auth-session'),'untouched');assert.equal(f.values.get('health-data'),'untouched');
 assert.ok(f.calls.every(([,key])=>key==='@healthycheck:language'));
 await assert.rejects(f.api.persistLanguage('fr'));
 assert.equal(storageFixture('fr').api.resolveLanguage('fr','vi'),'vi');
});
test('storage errors fail safely; rapid preference writes are ordered',async()=>{
 assert.equal(await storageFixture(null,true).api.readLanguage('vi'),'vi');
 await assert.rejects(storageFixture(null,false,true).api.persistLanguage('vi'));
 const writes=[];let release;
 const storage={getItem:async()=>null,setItem:async(key,value)=>{if(value==='vi')await new Promise(resolve=>{release=resolve;});writes.push(value);}};
 const api=createLoader({'@react-native-async-storage/async-storage':storage})('src/i18n/languageStorage');
 const first=api.persistLanguage('vi'),second=api.persistLanguage('en');
 await Promise.resolve();await Promise.resolve();release();await Promise.all([first,second]);
 assert.deepEqual(writes,['vi','en']);
});
test('live language changes update translations, plurals and pre-existing error feedback',async()=>{
 await initialization;await i18n.changeLanguage('en');
 assert.equal(i18n.t('navigation.overview'),'Overview');
 assert.equal(i18n.t('units.stepCount',{count:1,value:'1'}),'1 step');
 assert.equal(i18n.t('units.stepCount',{count:2,value:'2'}),'2 steps');
 assert.equal(localizeMessage('Email hoặc mật khẩu không đúng.'),'The email or password is incorrect.');
 assert.equal(localizeMessage('validation.passwordMatch'),'The passwords do not match.');
 await i18n.changeLanguage('vi');
 assert.equal(i18n.t('navigation.overview'),'Tổng quan');
 assert.equal(i18n.t('units.stepCount',{count:2,value:'2'}),'2 bước');
 assert.equal(localizeMessage('The email or password is incorrect.'),'Email hoặc mật khẩu không đúng.');
 assert.match(localizeMessage('Thiếu trường steps'),/số bước/);
 assert.equal(localizeMessage('unknown private server detail'),vi.errors.general);
 await i18n.changeLanguage('en');assert.equal(i18n.t('navigation.overview'),'Overview');
});
test('number/date/time display follows the language without changing underlying data',async()=>{
 const stamp='2026-10-27T14:30:00Z';const original={steps:11857,weight:68.5,recorded_at:stamp};
 await i18n.changeLanguage('en');assert.equal(formatting.formatNumber(original.steps),'11,857');assert.equal(formatting.formatDate('2026-10-27'),'October 27, 2026');
 const enTime=formatting.formatTime(stamp);assert.match(enTime,/AM|PM/);
 await i18n.changeLanguage('vi');assert.equal(formatting.formatNumber(original.steps),'11.857');assert.equal(formatting.formatNumber(original.weight,1),'68,5');
 assert.match(formatting.formatDate('2026-10-27'),/27.*10.*2026/);assert.doesNotMatch(formatting.formatTime(stamp),/AM|PM/);
 assert.equal(formatting.formatDuration(91),'1 giờ 31 phút');assert.equal(formatting.formatNumber(NaN),'—');
 assert.deepEqual(original,{steps:11857,weight:68.5,recorded_at:stamp});
});
test('local article content translates by stable IDs; identities, authors and routes remain unchanged',async()=>{
 const raw=load('src/data/articles').articles;
 await i18n.changeLanguage('en');const english=localizeStaticData(raw);
 await i18n.changeLanguage('vi');const vietnamese=localizeStaticData(raw);
 assert.notEqual(english[0].title,vietnamese[0].title);assert.match(vietnamese[0].content,/Giữ giờ ngủ/);
 assert.deepEqual(english.map(item=>item.id),vietnamese.map(item=>item.id));
 assert.deepEqual(english.map(item=>item.categoryId),vietnamese.map(item=>item.categoryId));
 assert.equal(english[0].author,vietnamese[0].author);
 assert.equal(raw[0].title,'articles.items.article1.title');
 const cycle=load('src/data/cycle').symptoms;
 assert.equal(localizeStaticData(cycle)[0].name,vi.cycle.cramps);
 const metrics=localizeStaticData(load('src/data/health').healthMetrics);
 assert.equal(metrics.find(item=>item.id==='calories').name,vi.calories.burned);
 assert.equal(metrics.find(item=>item.id==='nutrition').unit,vi.units.caloriesEaten);
 assert.equal(metrics.find(item=>item.id==='steps').unit,vi.units.steps);
 const sleep=load('src/data/sleep').sleepData;
 const vietnameseTime=localizeStaticData(sleep).bedtime;
 await i18n.changeLanguage('en');
 assert.notEqual(localizeStaticData(sleep).bedtime,vietnameseTime);
});
test('all literal translation keys in screens and bundled content exist in both languages',()=>{
 const resources=new Set(flatten(en).map(([key])=>key));
 function scan(dir) {for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())scan(name);else if(/\.tsx?$/.test(name)){
  const source=fs.readFileSync(name,'utf8'),ast=ts.createSourceFile(name,source,99,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node) {if(ts.isStringLiteral(node)){
   const value=node.text;
   if(/^(common|auth|onboarding|navigation|health|period|overview|explore|articles|steps|sleep|water|nutrition|meals|calories|bmi|heart|cycle|profile|settings|schedule|sharing|units|category|weekday|errors|validation|fields)\.[A-Za-z]/.test(value))assert.ok(resources.has(value)||resources.has(value+'_other'),name+': '+value);
  }ts.forEachChild(node,visit);}visit(ast);
 }}}
 scan(path.join(__dirname,'../app'));scan(path.join(__dirname,'../src/components'));scan(path.join(__dirname,'../src/data'));
});
