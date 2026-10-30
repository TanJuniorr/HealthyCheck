import {supabase} from '../lib/supabase';
import {DataAccessError,dataError} from '../lib/dataErrors';
import {validId} from '../lib/dataValidation';
import {assertIdentity,requireAuthenticatedUserId,type QueryResponse} from './queryCore';
import type {ArticleCategory,ArticleDetail,ArticleInput,ArticleLanguage,ArticleMode,ArticlePage,ArticleRow,ArticleStatus,ArticleTranslation,CategoryInput} from '../types/articles';
async function result<T>(request:PromiseLike<QueryResponse<T>>,owner:string):Promise<T|null>{
 const response=await Promise.resolve(request).catch(e=>{throw dataError(e);});
 if(response.error){const code=(response.error as {code?:string}).code;
  if(code==='40001')throw new DataAccessError('CONSTRAINT','cms.conflict');
  if(code==='23514')throw new DataAccessError('CONSTRAINT','cms.invalidPublication');
  if(code==='23505')throw new DataAccessError('CONSTRAINT','cms.duplicate');
  if(code==='23503'||code==='23001')throw new DataAccessError('CONSTRAINT','cms.categoryInUse');
  throw dataError(response.error);
 }
 await assertIdentity(owner);return response.data;
}
export async function getArticleRole(){const owner=await requireAuthenticatedUserId();const row=await result<{role:'admin'|'user'}>(supabase.from('user_roles').select('role').eq('user_id',owner).maybeSingle(),owner);return row?.role??'user';}
export async function getArticleCategories(admin=false):Promise<ArticleCategory[]>{
 const owner=await requireAuthenticatedUserId();let query=supabase.from('article_categories').select('*').order('sort_order').order('name_vi').limit(100);
 if(!admin)query=query.eq('is_active',true);
 return await result(query,owner)??[];
}
export type ArticleQuery={language:ArticleLanguage;search?:string;category?:string|null;mode?:ArticleMode;page?:number;pageSize?:number;status?:ArticleStatus|null};
export async function getArticleFeed(options:ArticleQuery):Promise<ArticlePage>{
 const search=(options.search??'').normalize('NFC').trim(),page=options.page??1,size=Math.min(options.pageSize??12,30);
 if(search.length>160||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(size)||size<1||(page-1)*size>2147483647)throw new DataAccessError('INVALID_INPUT','cms.invalidQuery');
 if(options.category)validId(options.category);
 const owner=await requireAuthenticatedUserId();
 const response=await result(supabase.rpc('article_feed',{p_language:options.language,p_query:search,p_category:options.category??null,p_mode:options.mode??'latest',p_offset:(page-1)*size,p_limit:size,p_status:options.status??null}),owner);
 if(!response||!Array.isArray(response.data)||response.data.length>size||!Number.isSafeInteger(response.total)||response.total<0)throw new DataAccessError('DATABASE','errors.database');
 return {...response,page,hasMore:(page-1)*size+response.data.length<response.total};
}
export async function getArticle(id:string,language:ArticleLanguage):Promise<ArticleDetail|null>{validId(id);const owner=await requireAuthenticatedUserId();return result(supabase.rpc('get_article',{p_id:id,p_language:language}),owner);}
export async function getArticleTranslations(id:string){validId(id);const owner=await requireAuthenticatedUserId();return await result(supabase.from('article_translations').select('id,article_id,language,title,summary,content,reading_time_minutes,source_name,source_url,reference_links,updated_at').eq('article_id',id).limit(2),owner)??[];}
export async function getArticleStats(){const owner=await requireAuthenticatedUserId();return result(supabase.rpc('article_admin_stats'),owner);}
export async function saveArticle(id:string|null,expected:string|null,article:ArticleInput,translations:ArticleTranslation[]):Promise<ArticleRow>{
 if(id)validId(id);validId(article.category_id);
 const owner=await requireAuthenticatedUserId();const saved=await result(supabase.rpc('save_article',{p_id:id,p_expected_updated_at:expected,p_article:article,p_translations:translations}),owner);
 if(!saved)throw new DataAccessError('DATABASE','errors.database');return saved;
}
export async function deleteArticle(id:string,expected:string){validId(id);const owner=await requireAuthenticatedUserId();const deleted=await result(supabase.from('articles').delete().eq('id',id).eq('updated_at',expected).select('id').maybeSingle(),owner);if(!deleted)throw new DataAccessError('CONSTRAINT','cms.conflict');}
export async function recordArticleRead(id:string){validId(id);const owner=await requireAuthenticatedUserId();await result(supabase.rpc('record_article_read',{p_article_id:id}),owner);}
export async function setArticleBookmark(id:string,saved:boolean){
 validId(id);const owner=await requireAuthenticatedUserId();
 if(!saved){await result(supabase.from('article_bookmarks').delete().eq('user_id',owner).eq('article_id',id),owner);return;}
 const response=await supabase.from('article_bookmarks').insert({user_id:owner,article_id:id}).select('id').single();
 if(response.error?.code==='23505'){const row=await result(supabase.from('article_bookmarks').select('id').eq('user_id',owner).eq('article_id',id).maybeSingle(),owner);if(row)return;}
 await result(Promise.resolve(response),owner);
}
export async function getArticleInterests(){const owner=await requireAuthenticatedUserId();return (await result(supabase.from('article_category_preferences').select('category_id').eq('user_id',owner).limit(100),owner)??[]).map(r=>r.category_id);}
export async function setArticleInterest(id:string,selected:boolean){
 validId(id);const owner=await requireAuthenticatedUserId();
 if(selected){const response=await supabase.from('article_category_preferences').insert({user_id:owner,category_id:id});if(response.error?.code==='23505'){await assertIdentity(owner);return;}await result(Promise.resolve(response),owner);}
 else await result(supabase.from('article_category_preferences').delete().eq('user_id',owner).eq('category_id',id),owner);
}
export async function saveArticleCategory(id:string|null,input:CategoryInput){
 if(id)validId(id);if(!Number.isSafeInteger(input.sort_order))throw new DataAccessError('INVALID_INPUT','cms.invalidQuery');
 const owner=await requireAuthenticatedUserId();const row=await result(id?supabase.from('article_categories').update(input).eq('id',id).select('*').single():supabase.from('article_categories').insert(input).select('*').single(),owner);
 if(!row)throw new DataAccessError('DATABASE','errors.database');return row;
}
export async function deleteArticleCategory(id:string){validId(id);const owner=await requireAuthenticatedUserId();const row=await result(supabase.from('article_categories').delete().eq('id',id).select('id').maybeSingle(),owner);if(!row)throw new DataAccessError('NOT_FOUND','cms.unavailable');}
