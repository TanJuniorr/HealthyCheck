import * as ImagePicker from 'expo-image-picker';
import {Platform} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {supabase} from '../lib/supabase';
import {assertIdentity,requireAuthenticatedUserId} from './queryCore';
import {DataAccessError,dataError} from '../lib/dataErrors';
import {validId} from '../lib/dataValidation';
import {validArticleImagePath} from '../lib/articleContent';
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
export type PickedArticleImage={uri:string;bytes:Uint8Array;mime:'image/jpeg'|'image/png'|'image/webp'};
export async function pickArticleImage(expectedOwner:string):Promise<PickedArticleImage|null>{
 validId(expectedOwner);
 // Open the web picker in the original click gesture; network auth checks must
 // not consume the browser's transient activation before the file dialog opens.
 const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:1,allowsEditing:false,exif:false});
 if(picked.canceled)return null;const asset=picked.assets[0];
 const owner=await requireAuthenticatedUserId();if(owner!==expectedOwner)throw new DataAccessError('AUTH_CHANGED','errors.general');
 if(!asset||asset.fileSize&&asset.fileSize>ARTICLE_IMAGE_LIMIT)throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 if(asset.mimeType&&!['image/jpeg','image/png','image/webp'].includes(asset.mimeType))throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 const buffer=Platform.OS==='web'&&asset.file?await asset.file.arrayBuffer():await (await fetch(asset.uri)).arrayBuffer();
 const bytes=new Uint8Array(buffer),mime=articleImageType(bytes);
 if(!mime||!bytes.byteLength||bytes.byteLength>ARTICLE_IMAGE_LIMIT)throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 await assertIdentity(owner);
 return {uri:asset.uri,bytes,mime};
}
export async function uploadArticleImage(articleId:string,expectedOwner:string,selected?:PickedArticleImage):Promise<string|null>{
 validId(articleId);validId(expectedOwner);
 const image=selected??await pickArticleImage(expectedOwner);if(!image)return null;
 const owner=await requireAuthenticatedUserId();if(owner!==expectedOwner)throw new DataAccessError('AUTH_CHANGED','errors.general');
 const {bytes}=image,mime=articleImageType(bytes);
 if(!mime||!bytes.byteLength||bytes.byteLength>ARTICLE_IMAGE_LIMIT)throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 await assertIdentity(owner);
 const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp',path=`${owner}/${articleId}/${randomUUID()}.${ext}`;
 const {error}=await supabase.storage.from('article-images').upload(path,bytes.buffer as ArrayBuffer,{contentType:mime,upsert:false,cacheControl:'60'});
 if(error)throw dataError(error);await assertIdentity(owner);return path;
}
export async function deleteArticleImage(path:string){
 if(!validArticleImagePath(path))throw new DataAccessError('INVALID_INPUT','cms.invalidImage');
 const owner=await requireAuthenticatedUserId();if(!path.startsWith(owner+'/'))throw new DataAccessError('PERMISSION_DENIED','cms.imageOwner');
 const {data,error}=await supabase.storage.from('article-images').remove([path]);if(error)throw dataError(error);await assertIdentity(owner);
 if(!data?.length)throw new DataAccessError('CONSTRAINT','cms.imageInUse');
}
