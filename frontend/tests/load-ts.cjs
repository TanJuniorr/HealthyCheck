/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
module.exports = function createLoader(overrides = {}) {
 const cache = new Map();
 function load(filename) {
  let absolute = path.resolve(__dirname,'..',filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.json') ? filename : filename+'.ts');
  if (!fs.existsSync(absolute) && absolute.endsWith('.ts')) absolute = absolute.slice(0,-3)+'.tsx';
  if (absolute in overrides) return overrides[absolute];
  if (absolute.endsWith('.json')) return JSON.parse(fs.readFileSync(absolute,'utf8'));
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute,'utf8');
  const module = { exports:{} }; cache.set(absolute,module);
  const code = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code,{ module,exports:module.exports,require(name) {
   if (name in overrides) return overrides[name];
   if (name.startsWith('.')) return load(path.relative(path.join(__dirname,'..'),path.resolve(path.dirname(absolute),name)));
   return require(name);
  },Date,Promise,Error,URL,Set,Map,Number,Object,Array,String,Math,console },{ filename:absolute });
  return module.exports;
 }
 return load;
};
