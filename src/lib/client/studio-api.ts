export async function studioRequest(path:string,method='GET',data?:unknown){const response=await fetch(path,{method,cache:'no-store',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined});const body=await response.json();if(!response.ok)throw Error(body.error||'Requête refusée.');return body;}
export async function streamStudioChat(projectId:number,input:any,onProgress:(run:any)=>void){
 const response=await fetch(`/api/v1/projects/${projectId}/chat/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});if(!response.ok)throw Error((await response.json()).error||'Accès refusé.');const reader=response.body?.getReader();if(!reader)throw Error('Flux indisponible.');
 const decoder=new TextDecoder();let buffer='',result:any;
 try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let index;while((index=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,index);buffer=buffer.slice(index+2);const type=block.split('\n').find(l=>l.startsWith('event: '))?.slice(7);const data=block.split('\n').find(l=>l.startsWith('data: '))?.slice(6);if(!data)continue;const parsed=JSON.parse(data);if(type==='progress')onProgress(parsed);if(type==='result')result=parsed;}}
 if(!result)throw Error('Connexion interrompue. Rechargez l’historique avant de relancer la demande.');return result;
 }finally{reader.releaseLock();}
}
