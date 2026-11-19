export async function limitedBody(request:Pick<Request,'headers'|'body'>,limit:number):Promise<Buffer>{
 if(Number(request.headers.get('content-length'))>limit)throw Error('Fichier trop volumineux.');
 const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks:Buffer[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Fichier trop volumineux.');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return Buffer.concat(chunks);
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');const expected=process.env.STUDIO_PUBLIC_ORIGIN;if(!expected||origin!==new URL(expected).origin)throw Error('Origine de la requête refusée.');}
