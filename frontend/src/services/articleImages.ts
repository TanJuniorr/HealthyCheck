import * as ImagePicker from 'expo-image-picker';
import {Platform} from 'react-native';
import {supabase} from '../lib/supabase';
import {assertIdentity,requireAuthenticatedUserId} from './queryCore';
import {DataAccessError,dataError} from '../lib/dataErrors';
import {validId} from '../lib/dataValidation';
import {validArticleImagePath} from '../lib/articleContent';
import {optimizeArticleImage} from '../lib/optimizeArticleImage';
export const ARTICLE_IMAGE_LIMIT=5*1024*1024;
export function articleImageType(bytes:Uint8Array):'image/jpeg'|'image/png'|'image/webp'|null{
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function getArticleImageUrl(path:string){
 if(!validArticleImagePath(path))throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 const owner=await requireAuthenticatedUserId();const {data,error}=await supabase.storage.from('article-images').createSignedUrl(path,60);
 if(error)throw dataError(error);await assertIdentity(owner);if(!data?.signedUrl)throw new DataAccessError('DATABASE','errors.database');return data.signedUrl;
}
export async function uploadArticleImage(articleId:string,expectedOwner:string):Promise<string|null>{
 validId(articleId);if(Platform.OS!=='web')throw new DataAccessError('INVALID_INPUT','cms.webOnly');
 validId(expectedOwner);
 // Open the web picker in the original click gesture; network auth checks must
 // not consume the browser's transient activation before the file dialog opens.
 const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.85,allowsEditing:false});
 if(picked.canceled)return null;const asset=picked.assets[0];
 const owner=await requireAuthenticatedUserId();if(owner!==expectedOwner)throw new DataAccessError('AUTH_CHANGED','errors.general');
 if(asset.fileSize&&asset.fileSize>20*1024*1024)throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 let bytes:Uint8Array=new Uint8Array(await (asset.file?asset.file.arrayBuffer():(await fetch(asset.uri)).arrayBuffer()));
 if(!articleImageType(bytes))throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 bytes=await optimizeArticleImage(bytes,articleImageType(bytes)!);
 const mime=articleImageType(bytes);if(!mime||bytes.byteLength>ARTICLE_IMAGE_LIMIT)throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 await assertIdentity(owner);
 const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp',path=`${owner}/${articleId}/${globalThis.crypto.randomUUID()}.${ext}`;
 const {error}=await supabase.storage.from('article-images').upload(path,bytes.buffer as ArrayBuffer,{contentType:mime,upsert:false,cacheControl:'60'});
 if(error)throw dataError(error);await assertIdentity(owner);return path;
}
export async function deleteArticleImage(path:string){
 if(!validArticleImagePath(path))throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 const owner=await requireAuthenticatedUserId();if(!path.startsWith(owner+'/'))throw new DataAccessError('PERMISSION_DENIED','cms.imageOwner');
 const {error}=await supabase.storage.from('article-images').remove([path]);if(error)throw dataError(error);await assertIdentity(owner);
}
