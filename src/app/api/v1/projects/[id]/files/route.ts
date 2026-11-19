import {NextResponse} from 'next/server';
import {listWorkspaceFiles,readWorkspaceFile,mutateWorkspaceFile} from '@/lib/workspace-files';
import {sameOrigin,limitedBody} from '@/lib/http-limits';
export const dynamic='force-dynamic';
function error(e:any){return NextResponse.json({error:e.message||'Opération impossible.'},{status:e.status||(/Authentification|Session/.test(e.message)?401:/accès refusé|introuvable/i.test(e.message)?403:400),headers:{'Cache-Control':'no-store'}});}
export async function GET(request:Request,{params}:{params:{id:string}}){try{const path=new URL(request.url).searchParams.get('path');return NextResponse.json(path?{file:await readWorkspaceFile(Number(params.id),path)}:{files:await listWorkspaceFiles(Number(params.id))},{headers:{'Cache-Control':'private,no-store'}});}catch(e){return error(e);}}
async function change(request:Request,id:string,operation:string){try{sameOrigin(request);const input=JSON.parse((await limitedBody(request,6*1024*1024)).toString());return NextResponse.json({file:await mutateWorkspaceFile(Number(id),operation,input)});}catch(e){return error(e);}}
export async function POST(r:Request,{params}:{params:{id:string}}){return change(r,params.id,'create');}
export async function PUT(r:Request,{params}:{params:{id:string}}){return change(r,params.id,'save');}
export async function PATCH(r:Request,{params}:{params:{id:string}}){return change(r,params.id,'rename');}
export async function DELETE(r:Request,{params}:{params:{id:string}}){return change(r,params.id,'delete');}
