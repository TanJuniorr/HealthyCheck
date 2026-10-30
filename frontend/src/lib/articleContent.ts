import type {ArticleCategory,ArticleInput,ArticleLanguage,ArticleReference,ArticleTranslation,CategoryInput} from '../types/articles';
import {DataAccessError} from './dataErrors';
export function articleLanguage(language:string):ArticleLanguage{return language.startsWith('vi')?'vi':'en';}
export function categoryName(category:Pick<ArticleCategory,'name_vi'|'name_en'>,language:string){return language.startsWith('vi')?category.name_vi:category.name_en;}
export function articleSlug(title:string){return title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);}
export function safeArticleUrl(value:string):string|null{try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function validArticleImagePath(value:string){return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value);}
export function emptyArticleTranslation(language:ArticleLanguage):ArticleTranslation{return {language,title:'',summary:'',content:'',reading_time_minutes:1,source_name:'',source_url:'',reference_links:[]};}
export function parseArticleReferences(text:string):ArticleReference[]{return text.split('\n').filter(line=>line.trim()).map(line=>{const at=line.indexOf('|');return {name:line.slice(0,at).trim(),url:line.slice(at+1).trim()};});}
export function publicationReady(translations:ArticleTranslation[]){return translations.length>0&&translations.every(t=>t.title.trim()&&t.summary.trim()&&t.content.trim().length>=100&&t.source_name.trim()&&safeArticleUrl(t.source_url)&&t.reference_links.every(r=>r.name.trim()&&safeArticleUrl(r.url)));}
export function validateArticleInput(article:ArticleInput,translations:ArticleTranslation[]){
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.slug)||article.slug.length>160)throw new DataAccessError('INVALID_INPUT','cms.invalidSlug');
 if(!article.category_id)throw new DataAccessError('INVALID_INPUT','cms.requiredArticle');
 if(translations.some(tr=>!Number.isInteger(tr.reading_time_minutes)||tr.reading_time_minutes<1||tr.reading_time_minutes>120))throw new DataAccessError('INVALID_INPUT','cms.invalidReadingTime');
 if(translations.some(tr=>tr.source_url&&!safeArticleUrl(tr.source_url)||tr.reference_links.length>20||tr.reference_links.some(r=>!r.name||r.name.length>240||r.url.length>2048||!safeArticleUrl(r.url))))throw new DataAccessError('INVALID_INPUT','cms.invalidReferences');
 if(article.status==='published'&&!publicationReady(translations))throw new DataAccessError('INVALID_INPUT','cms.invalidPublication');
}
export function validateCategoryInput(input:CategoryInput){
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)||input.slug.length>100)throw new DataAccessError('INVALID_INPUT','cms.invalidSlug');
 if(!input.name_vi.trim()||!input.name_en.trim())throw new DataAccessError('INVALID_INPUT','cms.requiredCategory');
 if(!Number.isSafeInteger(input.sort_order)||Math.abs(input.sort_order)>2147483647)throw new DataAccessError('INVALID_INPUT','cms.invalidSortOrder');
}
export type MarkdownFormat='h2'|'h3'|'bold'|'italic'|'list'|'link';
export function formatArticleSelection(content:string,selection:{start:number;end:number},kind:MarkdownFormat,placeholder:string){
 const start=Math.max(0,Math.min(content.length,selection.start)),end=Math.max(start,Math.min(content.length,selection.end));
 const selected=content.slice(start,end)||placeholder;
 const prefix=start>0&&content[start-1]!=='\n'?'\n':'';
 const replacement=kind==='bold'?'**'+selected+'**':kind==='italic'?'*'+selected+'*':kind==='link'?'['+selected+'](https://)':prefix+(kind==='h2'?'## ':kind==='h3'?'### ':'- ')+selected;
 return {content:content.slice(0,start)+replacement+content.slice(end),selection:{start:start+replacement.length,end:start+replacement.length}};
}
export type MarkdownBlock={type:'h2'|'h3'|'paragraph'|'list'|'image';text:string;url?:string};
// A deliberately small Markdown subset. Raw HTML is always text, never a DOM,
// WebView, innerHTML or executable content. Images resolve only our private bucket.
export function articleBlocks(content:string):MarkdownBlock[]{
 const blocks:MarkdownBlock[]=[];let paragraph:string[]=[];
 const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
 for(const line of content.slice(0,100000).split(/\r?\n/)){
  if(!line.trim()){flush();continue;}
  const heading=/^(#{2,3})\s+(.+)$/.exec(line),list=/^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line),image=/^!\[([^\]]*)\]\(article-image:([^\s)]+)\)$/.exec(line);
  if(heading){flush();blocks.push({type:heading[1].length===2?'h2':'h3',text:heading[2]});}
  else if(list){flush();blocks.push({type:'list',text:list[1]});}
  else if(image&&validArticleImagePath(image[2])){flush();blocks.push({type:'image',text:image[1],url:image[2]});}
  else paragraph.push(line);
 }
 flush();return blocks;
}
export type InlinePart={text:string;type:'text'|'bold'|'italic'|'link';url?:string};
export function articleInlines(value:string):InlinePart[]{
 const tokens=/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^\s)]+)\)/g,result:InlinePart[]=[];let at=0;let match:RegExpExecArray|null;
 while((match=tokens.exec(value))){if(match.index>at)result.push({type:'text',text:value.slice(at,match.index)});
  const url=match[4]?safeArticleUrl(match[4]):null;
  result.push(match[1]?{type:'bold',text:match[1]}:match[2]?{type:'italic',text:match[2]}:url?{type:'link',text:match[3],url}:{type:'text',text:match[0]});at=tokens.lastIndex;
 }
 if(at<value.length)result.push({type:'text',text:value.slice(at)});return result;
}
