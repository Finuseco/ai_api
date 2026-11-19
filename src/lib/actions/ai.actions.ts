'use server';
import {generationPreview} from '../generation-preview';
import {selectProvider,AiProvider} from '../ai-providers';
import {requireUser} from '../auth';
import {randomUUID} from 'node:crypto';
import {db} from '../db';
import {requireProject} from '../project-access';
import {studioChat} from '@/ai/flows/studio-chat-flow';
import {openaiSettings} from '../openai-settings';
import {reserveGeneration,refundGeneration,generationBalance} from '../generation-ledger';
export async function sendChatMessage(projectId:number,message:string,attachments?:{url:string,contentType:string}[],requestId?:string,provider?:AiProvider){
 let reserved=false;const id=requestId||randomUUID();
 try{
  const {user}=await requireProject(projectId);
  if(!/^[0-9a-f-]{36}$/.test(id)||typeof message!=='string'||message.length>20000||attachments?.length>4)throw Error('Demande invalide.');
  selectProvider(provider);const settings=await openaiSettings(user.id);
  const reservation=await reserveGeneration(id,user.id,projectId,settings.ownKey);if(reservation.existing)return reservation.result;reserved=true;
  const history=(await db.query('SELECT role,content FROM jojo_ai_chat_history WHERE project_id=$1 ORDER BY created_at DESC LIMIT 8',[projectId])).rows.reverse();
  let last=0;
  const answer=await studioChat({apiKey:settings.apiKey,model:settings.model,projectId,message,attachments,history:history as any,onProgress:async text=>{
   if(Date.now()-last<700)return;last=Date.now();
   const paths=[...new Set([...text.matchAll(/"path"\s*:\s*"([^"\n]{1,240})"/g)].map(m=>m[1]))].slice(0,30);
   await db.query("UPDATE jojo_ai_generation_runs SET progress=$1::jsonb WHERE id=$2 AND status='reserved'",[JSON.stringify({stage:'receiving',characters:text.length,files:paths,...generationPreview(text)}),id]);
  }});
  await requireProject(projectId);const c=await db.getConnection();let result:any;
  try{await c.query('BEGIN');
   const run=(await c.query('SELECT status FROM jojo_ai_generation_runs WHERE id=$1 FOR UPDATE',[id])).rows[0];if(run?.status!=='reserved')throw Error('Génération déjà clôturée.');
   await c.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[projectId]);
   const pending=(await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(content)),0) AS bytes FROM project_pending_actions WHERE project_id=$1 AND status='pending'",[projectId])).rows[0];
   if(Number(pending.count)+answer.files.length>100||Number(pending.bytes)+answer.files.reduce((n,f)=>n+Buffer.byteLength(f.content),0)>5*1024*1024)throw Error('Validez les modifications en attente avant de continuer.');
   for(const f of answer.files)await c.query("INSERT INTO project_pending_actions(project_id,file_path,content,status,base_hash) VALUES($1,$2,$3,'pending',$4)",[projectId,f.path,f.content,f.baseHash]);
   await c.query('INSERT INTO jojo_ai_chat_history(project_id,role,content) VALUES($1,$2,$3),($1,$4,$5)',[projectId,'user',message,'model',answer.message]);
   const balance=await generationBalance(user.id);
   result={success:true,text:answer.message,newBalance:balance.total,refreshFiles:true};
   await c.query("UPDATE jojo_ai_generation_runs SET status='complete',result=$1::jsonb,progress=$3::jsonb WHERE id=$2",[JSON.stringify(result),id,JSON.stringify({stage:'review',characters:0,files:answer.files.map(f=>f.path)})]);await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  return result;
 }catch(error:any){if(reserved)await refundGeneration(id).catch(()=>console.error('[Generation] Réconciliation requise',id));return {success:false,error:reserved?'La génération a été interrompue. Aucun fichier appliqué. Vérifiez la configuration OpenAI.':error.message};}
}
export async function getChatHistory(projectId:number){try{await requireProject(projectId);const {rows}=await db.query('SELECT role,content,created_at FROM jojo_ai_chat_history WHERE project_id=$1 ORDER BY created_at',[projectId]);return {success:true,history:rows};}catch{return {success:false,history:[]};}}
export async function getAiProviders(){try{const user=await requireUser();const own=Boolean((await db.query('SELECT user_id FROM jojo_ai_openai_accounts WHERE user_id=$1',[user.id])).rows[0]);return {success:true,providers:[{id:'codex' as const,label:'OpenAI · Codage',model:process.env.OPENAI_CODEX_MODEL||null,configured:Boolean(process.env.OPENAI_CODEX_MODEL&&(own||process.env.OPENAI_API_KEY))}],defaultProvider:'codex'};}catch{return {success:false,providers:[],defaultProvider:'codex'};}}
export async function getGenerationProgress(projectId:number,id:string){try{const {user}=await requireProject(projectId);if(!/^[0-9a-f-]{36}$/.test(id))throw Error();const row=(await db.query('SELECT status,progress FROM jojo_ai_generation_runs WHERE id=$1 AND project_id=$2 AND user_id=$3',[id,projectId,user.id])).rows[0];return {success:Boolean(row),run:row||null};}catch{return {success:false,run:null};}}
