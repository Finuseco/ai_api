import {limitedBody} from './http-limits';
export interface CodingMessage {role:'user'|'assistant';content:any[]}
function completedText(data:any){
 if(data.status!=='completed')throw Error('Réponse OpenAI incomplète. Aucune modification appliquée.');
 const parts:string[]=[];
 for(const item of data.output||[])if(item.type==='message')for(const content of item.content||[]){if(content.type==='refusal')throw Error('Le moteur a refusé cette demande.');if(content.type==='output_text'&&typeof content.text==='string')parts.push(content.text);}
 if(!parts.length)throw Error('Aucune proposition de code reçue.');return parts.join('\n');
}
/** Official Responses endpoint, streamed proposals; no shell or shared ChatGPT session. */
export async function openaiCoding(instructions:string,input:CodingMessage[],options?:{apiKey:string;model:string;onProgress?:(text:string)=>Promise<void>}):Promise<string>{
 const key=options?.apiKey||process.env.OPENAI_API_KEY,model=options?.model||process.env.OPENAI_CODEX_MODEL;
 if(!key||!model)throw Error('Configurez OPENAI_API_KEY et OPENAI_CODEX_MODEL côté serveur.');
 const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model,instructions,input,store:false,stream:true,max_output_tokens:16384}),
  redirect:'error',signal:AbortSignal.timeout(90000),cache:'no-store',
 });
 if(!response.ok)throw Error(response.status===401||response.status===403?'Accès au moteur OpenAI refusé.':response.status===429?'Le moteur OpenAI a atteint son quota.':'Le moteur OpenAI a refusé la génération. Vérifiez le modèle configuré.');
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return completedText(JSON.parse((await limitedBody(response,4*1024*1024)).toString('utf8')));
 const reader=response.body?.getReader();if(!reader)throw Error('Flux OpenAI indisponible.');
 const decoder=new TextDecoder();let buffer='',text='',received=0,complete:any;
 async function event(frame:string){const value=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!value||value==='[DONE]')return;const e=JSON.parse(value);
  if(e.type==='response.output_text.delta'&&typeof e.delta==='string'){text+=e.delta;if(text.length>2*1024*1024)throw Error('Réponse trop volumineuse.');await options?.onProgress?.(text);}
  if(e.type==='response.completed')complete=e.response;
  if(['response.failed','response.incomplete','error'].includes(e.type))throw Error('Génération OpenAI interrompue.');
 }
 try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>4*1024*1024)throw Error('Flux OpenAI trop volumineux.');buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');let index;while((index=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);await event(frame);}}buffer+=decoder.decode();if(buffer.trim())await event(buffer);return completedText(complete||{});}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
