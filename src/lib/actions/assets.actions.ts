'use server';
import {createHash} from 'node:crypto';
import {requireProject} from '../project-access';
import {db} from '../db';
import {openaiSettings} from '../openai-settings';
import {limitedBody} from '../http-limits';
import {reserveGeneration,refundGeneration} from '../generation-ledger';
import {trimLogo} from '../logo-image';
import {editablePath} from '../project-files';
import {studioChat} from '@/ai/flows/studio-chat-flow';
export async function generateLogo(projectId:number,prompt:string,path:string,requestId:string,integrate:boolean){
 let reserved=false;
 try{const {user,project}=await requireProject(projectId);if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||!/^[0-9a-f-]{36}$/.test(requestId))throw Error('Description ou identifiant invalide.');
  editablePath(path);if(!path.endsWith('.png'))throw Error('Utilisez un chemin PNG.');
  const settings=await openaiSettings(user.id),model=process.env.OPENAI_IMAGE_MODEL;if(!model)throw Error('Configurez OPENAI_IMAGE_MODEL côté serveur.');
  const snapshot=(await db.query('SELECT file_content FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2',[projectId,path])).rows[0];const baseHash=snapshot?createHash('sha256').update(snapshot.file_content).digest('hex'):'absent';
  const reservation=await reserveGeneration(requestId,user.id,projectId,settings.ownKey);if(reservation.existing)return reservation.result;reserved=true;
  await db.query("UPDATE jojo_ai_generation_runs SET progress=$1::jsonb WHERE id=$2",[JSON.stringify({stage:'image_requested',files:[path]}),requestId]);
  const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${settings.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,n:1,size:'1024x1024',quality:'medium',background:'transparent',output_format:'png',prompt:`Create a professional logo/icon asset for the application ${project.name}. Transparent background, clean edges, no mockup, no surrounding text unless the user explicitly requests a wordmark. Follow this design brief: ${prompt}`}),redirect:'error',signal:AbortSignal.timeout(120000),cache:'no-store'});
  if(!response.ok)throw Error('La génération d’image OpenAI a échoué. Vérifiez le modèle, le quota et les droits du compte.');
  const data=JSON.parse((await limitedBody(response,10*1024*1024)).toString('utf8'));if(typeof data.data?.[0]?.b64_json!=='string')throw Error('Aucun PNG reçu.');
  const png=trimLogo(Buffer.from(data.data[0].b64_json,'base64')),content=png.toString('base64');
  if(content.length>4*1024*1024)throw Error('Logo trop volumineux pour la validation.');
  let code:any[]=[];let description=`Logo PNG transparent proposé : ${path}. Validez-le dans Modifications avant utilisation.`;
  if(integrate){const answer=await studioChat({apiKey:settings.apiKey,model:settings.model,projectId,message:`Le client a demandé ce logo : ${prompt}. Un PNG transparent réel vient d’être généré et sera validé dans le même lot au chemin ${path}. Propose les changements minimaux dans les fichiers existants pour utiliser ce PNG comme logo/icône. Ne génère ni ne remplace ce PNG. Respecte le type d’application et la structure du projet.`,onProgress:async text=>{if(text.length%1000<100)await db.query("UPDATE jojo_ai_generation_runs SET progress=$1::jsonb WHERE id=$2 AND status='reserved'",[JSON.stringify({stage:'integrating_image',characters:text.length,files:[path]}),requestId]);}});code=answer.files.filter(f=>f.path!==path);description+='\n'+answer.message;}
  await requireProject(projectId);const c=await db.getConnection();
  try{await c.query('BEGIN');const run=(await c.query('SELECT status FROM jojo_ai_generation_runs WHERE id=$1 FOR UPDATE',[requestId])).rows[0];if(run?.status!=='reserved')throw Error('Génération clôturée.');await c.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[projectId]);
   const pending=(await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(content)),0) AS bytes FROM project_pending_actions WHERE project_id=$1 AND status='pending'",[projectId])).rows[0];
   if(Number(pending.count)+code.length+1>100||Number(pending.bytes)+content.length+code.reduce((n,f)=>n+Buffer.byteLength(f.content),0)>5*1024*1024)throw Error('Validez les modifications en attente avant de générer des images.');
   await c.query("INSERT INTO project_pending_actions(project_id,file_path,content,status,base_hash,file_encoding) VALUES($1,$2,$3,'pending',$4,'base64')",[projectId,path,content,baseHash]);
   for(const f of code)await c.query("INSERT INTO project_pending_actions(project_id,file_path,content,status,base_hash) VALUES($1,$2,$3,'pending',$4)",[projectId,f.path,f.content,f.baseHash]);
   await c.query('INSERT INTO jojo_ai_chat_history(project_id,role,content) VALUES($1,$2,$3),($1,$4,$5)',[projectId,'user',`Logo : ${prompt}`,'model',description]);
   const result={success:true,path};await c.query("UPDATE jojo_ai_generation_runs SET status='complete',result=$1::jsonb,progress=$3::jsonb WHERE id=$2",[JSON.stringify(result),requestId,JSON.stringify({stage:'review',files:[path,...code.map(f=>f.path)]})]);await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }catch(e:any){if(reserved)await refundGeneration(requestId).catch(()=>console.error('[Logo] Réconciliation requise',requestId));return {success:false,error:reserved?'Génération du logo interrompue. Aucun fichier appliqué. Vérifiez les modèles OpenAI et les modifications en attente.':e.message};}
}
