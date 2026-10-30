// The editorial upload flow is web-only; native readers never decode on the JS thread.
export async function optimizeArticleImage(bytes:Uint8Array,_mime:string):Promise<Uint8Array>{return bytes;}
