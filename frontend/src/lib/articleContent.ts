import type {ArticleCategory,ArticleLanguage,ArticleReference,ArticleTranslation} from '../types/articles';
export function articleLanguage(language:string):ArticleLanguage{return language.startsWith('vi')?'vi':'en';}
export function categoryName(category:Pick<ArticleCategory,'name_vi'|'name_en'>,language:string){return language.startsWith('vi')?category.name_vi:category.name_en;}
export function articleSlug(title:string){return title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);}
export function safeArticleUrl(value:string):string|null{try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function validArticleImagePath(value:string){return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value);}
export function emptyArticleTranslation(language:ArticleLanguage):ArticleTranslation{return {language,title:'',summary:'',content:'',reading_time_minutes:1,source_name:'',source_url:'',reference_links:[]};}
export function parseArticleReferences(text:string):ArticleReference[]{return text.split('\n').filter(line=>line.trim()).map(line=>{const at=line.indexOf('|');return {name:line.slice(0,at).trim(),url:line.slice(at+1).trim()};});}
export function publicationReady(translations:ArticleTranslation[]){return translations.length>0&&translations.every(t=>t.title.trim()&&t.summary.trim()&&t.content.trim().length>=100&&t.source_name.trim()&&safeArticleUrl(t.source_url)&&t.reference_links.every(r=>r.name.trim()&&safeArticleUrl(r.url)));}
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
