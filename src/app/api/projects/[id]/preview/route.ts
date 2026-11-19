import {NextResponse} from 'next/server';
import {db} from '@/lib/db';import {requireProject} from '@/lib/project-access';
import {previewFiles} from '@/lib/preview-assets';import {runtimeRunner} from '@/lib/runtime-runner';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){try{
 const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)throw Error();
 const project=(await db.query('SELECT is_public,dev_portal_user_id,app_template FROM jojo_ai_projects WHERE id=$1',[id])).rows[0];if(!project)throw Error();
 let member=false;try{await requireProject(id);member=true;}catch{}if(!project.is_public&&!member)throw Error();
 let publishedUrl:string|null=null;
 if(process.env.RUNTIME_RUNNER_URL){try{const state=await runtimeRunner(`/v1/jobs?userId=${project.dev_portal_user_id}&projectId=${id}`);if(state.site?.url){const url=new URL(state.site.url),studio=new URL(process.env.STUDIO_PUBLIC_ORIGIN||'http://localhost');if(url.protocol==='https:'&&url.origin!==studio.origin)publishedUrl=url.toString();}}catch{}}
 if(publishedUrl)return NextResponse.json({publishedUrl,files:[],requiresBuild:false},{headers:{'Cache-Control':'private,no-store'}});
 const {rows}=await db.query('SELECT file_path AS path,file_content AS content,file_encoding AS encoding FROM jojo_ai_project_files WHERE project_id=$1 ORDER BY file_path',[id]);
 let requiresBuild=false;try{requiresBuild=Boolean(JSON.parse(rows.find(f=>f.path==='package.json')?.content||'{}').scripts?.build);}catch{}
 if(/<script[^>]+(?:type=["']module|src=["'][^"']+\.tsx?)/i.test(rows.find(f=>f.path==='index.html'||f.path==='public/index.html')?.content||''))requiresBuild=true;
 return NextResponse.json({files:previewFiles(rows,member),requiresBuild,nativeAndroid:project.app_template==='android'&&!rows.some(f=>f.path==='index.html'||f.path==='public/index.html')},{headers:{'Cache-Control':'private,no-store'}});
}catch{return NextResponse.json({error:'Aperçu privé ou projet introuvable.'},{status:403});}}
