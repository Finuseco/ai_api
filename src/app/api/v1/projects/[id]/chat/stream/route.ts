import {requireProject} from '@/lib/project-access';
import {sendChatMessage,getGenerationProgress} from '@/lib/actions/ai.actions';
import {sameOrigin,limitedBody} from '@/lib/http-limits';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:{id:string}}){
 try{sameOrigin(request);const id=Number(params.id);await requireProject(id);const input=JSON.parse((await limitedBody(request,12*1024*1024)).toString());const requestId=input.requestId||crypto.randomUUID();if(typeof requestId!=='string'||! /^[0-9a-f-]{36}$/.test(requestId))throw Error('Identifiant invalide.');
  let timer:ReturnType<typeof setInterval>,closed=false,polling=false;const encode=new TextEncoder();
  const stream=new ReadableStream({start(controller){const send=(type:string,data:any)=>{if(!closed)controller.enqueue(encode.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));};
   send('accepted',{requestId});timer=setInterval(async()=>{if(closed||polling)return;polling=true;try{const progress=await getGenerationProgress(id,requestId);if(progress.success)send('progress',progress.run);}finally{polling=false;}},750);
   sendChatMessage(id,input.message,input.attachments,requestId,'codex').then(result=>send('result',result)).catch(()=>send('result',{success:false,error:'Génération interrompue.'})).finally(()=>{clearInterval(timer);if(!closed){closed=true;controller.close();}});
  },cancel(){closed=true;clearInterval(timer);}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache,no-store','X-Accel-Buffering':'no','Connection':'keep-alive'}});
 }catch(e:any){return Response.json({error:e.message},{status:400});}
}
