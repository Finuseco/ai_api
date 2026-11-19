import {NextResponse} from 'next/server';
import {requireProject} from '@/lib/project-access';
import {androidRunner} from '@/lib/android-runner';
import {limitedBody,sameOrigin} from '@/lib/http-limits';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){try{const {user}=await requireProject(Number(params.id));if(!process.env.ANDROID_RUNNER_URL)return NextResponse.json({configured:false,session:null});return NextResponse.json(await androidRunner(`/v1/sessions?userId=${user.id}&projectId=${params.id}`));}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
export async function POST(request:Request,{params}:{params:{id:string}}){try{sameOrigin(request);const {user}=await requireProject(Number(params.id));const id=new URL(request.url).searchParams.get('session');
 if(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Session invalide.');return NextResponse.json(await androidRunner(`/v1/sessions/${id}/apk?userId=${user.id}&projectId=${params.id}`,'POST',new Uint8Array(await limitedBody(request,25*1024*1024)),'application/vnd.android.package-archive'));}
 return NextResponse.json(await androidRunner('/v1/sessions','POST',JSON.stringify({userId:user.id,projectId:Number(params.id)})));
}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
export async function DELETE(request:Request,{params}:{params:{id:string}}){try{sameOrigin(request);const {user}=await requireProject(Number(params.id));const id=new URL(request.url).searchParams.get('session');if(!id||!/^[a-f0-9-]{36}$/.test(id))throw Error('Session invalide.');return NextResponse.json(await androidRunner(`/v1/sessions/${id}?userId=${user.id}&projectId=${params.id}`,'DELETE'));}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
