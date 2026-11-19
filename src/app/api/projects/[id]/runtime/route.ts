import {NextResponse} from 'next/server';
import {requireProject} from '@/lib/project-access';
import {runtimeRunner} from '@/lib/runtime-runner';
import {projectFiles} from '@/lib/project-snapshots';
import {limitedBody,sameOrigin} from '@/lib/http-limits';
import {db} from '@/lib/db';
import {parseCommand} from '../../../../../../server/runtime/commands.cjs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){try{
 const {project,isOwner}=await requireProject(Number(params.id));
 const jobId=new URL(request.url).searchParams.get('jobId');if(jobId&&!/^[0-9a-f-]{36}$/.test(jobId))throw Error('Job invalide.');
 const info={previewPath:`/p/${params.id}`,isPublic:Boolean(project.is_public),canExecute:isOwner};
 if(!process.env.RUNTIME_RUNNER_URL)return NextResponse.json({...info,configured:false,jobs:[],site:null});
 return NextResponse.json({...info,configured:true,...await runtimeRunner(`/v1/jobs?userId=${project.dev_portal_user_id}&projectId=${params.id}${jobId?'&jobId='+jobId:''}`)},{headers:{'Cache-Control':'private,no-store'}});
}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
export async function POST(req:Request,{params}:{params:{id:string}}){try{
 sameOrigin(req);const id=Number(params.id),{user}=await requireProject(id,true),data=JSON.parse((await limitedBody(req,4096)).toString());
 if(data.domain)return NextResponse.json(await runtimeRunner('/v1/domains','POST',{action:data.action,domain:data.domain,siteId:data.siteId,userId:user.id,projectId:id}));
 if(data.action==='cancel'){if(typeof data.jobId!=='string'||!/^[0-9a-f-]{36}$/.test(data.jobId))throw Error('Job invalide.');return NextResponse.json(await runtimeRunner('/v1/jobs/cancel','POST',{jobId:data.jobId,userId:user.id,projectId:id}));}
 if(data.action==='review-dependencies'){
  if(typeof data.jobId!=='string'||!/^[0-9a-f-]{36}$/.test(data.jobId))throw Error('Job invalide.');
  const state=await runtimeRunner(`/v1/jobs?userId=${user.id}&projectId=${id}&jobId=${data.jobId}&includeProposals=1`),job=state.jobs.find((j:any)=>j.id===data.jobId);
  if(!job||job.status!=='complete'||job.action!=='install-packages'||!Array.isArray(job.proposedFiles)||!job.proposedFiles.length)throw Error('Ce job ne contient aucun manifeste terminé à proposer.');
  if(job.proposedFiles.length>2)throw Error('Résultat du worker invalide.');
  for(const f of job.proposedFiles){if(!['package.json','package-lock.json'].includes(f.path)||typeof f.content!=='string'||Buffer.byteLength(f.content)>1024*1024||! /^(?:absent|[a-f0-9]{64})$/.test(f.baseHash))throw Error('Manifeste invalide.');JSON.parse(f.content);}
  const c=await db.getConnection();try{await c.query('BEGIN');await c.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[id]);
   const existing=(await c.query('SELECT id FROM project_pending_actions WHERE project_id=$1 AND runtime_job_id=$2',[id,job.id])).rows;if(existing.length){await c.query('ROLLBACK');return NextResponse.json({success:true,alreadyProposed:true});}
   const pending=(await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(content)),0) AS bytes FROM project_pending_actions WHERE project_id=$1 AND status='pending'",[id])).rows[0];
   if(Number(pending.count)+job.proposedFiles.length>100||Number(pending.bytes)+job.proposedFiles.reduce((n:number,f:any)=>n+Buffer.byteLength(f.content),0)>5*1024*1024)throw Error('Validez les modifications en attente avant de continuer.');
   for(const f of job.proposedFiles)await c.query("INSERT INTO project_pending_actions(project_id,file_path,content,status,base_hash,runtime_job_id) VALUES($1,$2,$3,'pending',$4,$5)",[id,f.path,f.content,f.baseHash,job.id]);
   await c.query('COMMIT');return NextResponse.json({success:true,count:job.proposedFiles.length});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 if(data.action==='command')parseCommand(data.command);
 else if(!['install','build','publish-static','build-and-publish'].includes(data.action))throw Error('Opération invalide.');
 return NextResponse.json(await runtimeRunner('/v1/jobs','POST',{action:data.action,command:data.command,userId:user.id,projectId:id,files:await projectFiles(id)}));
}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
