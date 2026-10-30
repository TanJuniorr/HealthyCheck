export async function optimizeArticleImage(bytes:Uint8Array,mime:string):Promise<Uint8Array>{
 const objectUrl=URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer],{type:mime}));
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=reject;image.src=objectUrl;});
  const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const context=canvas.getContext('2d');if(!context)return bytes;context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime==='image/png'?'image/png':'image/webp',0.82));
  if(!blob)return bytes;const compressed=new Uint8Array(await blob.arrayBuffer());return compressed.byteLength<bytes.byteLength?compressed:bytes;
 }finally{URL.revokeObjectURL(objectUrl);}
}
