import {NextResponse} from 'next/server';
import {requireProject} from '@/lib/project-access';
import {projectFiles,storeImportedFiles} from '@/lib/project-snapshots';
import {projectZip,readArchive} from '@/lib/project-archive';
import {limitedBody,sameOrigin} from '@/lib/http-limits';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){try{const id=Number(params.id);await requireProject(id);const zip=await projectZip(await projectFiles(id));return new Response(new Uint8Array(zip),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="jojo-project-${id}.zip"`,'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Export refusé ou projet indisponible.'},{status:403});}}
export async function POST(request:Request,{params}:{params:{id:string}}){try{sameOrigin(request);const id=Number(params.id);await requireProject(id,true);const content=await limitedBody(request,20*1024*1024);const archive=await readArchive(content);await storeImportedFiles(id,archive.files);return NextResponse.json({success:true,count:archive.files.length,skipped:archive.skipped});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
