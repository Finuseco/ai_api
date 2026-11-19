import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {getProjectsForUser,createJojoAiProject} from '@/lib/actions/dev-portal.actions';
import {sameOrigin,limitedBody} from '@/lib/http-limits';
export const dynamic='force-dynamic';
export async function GET(){try{await requireUser();const data=await getProjectsForUser();return NextResponse.json(data,{status:data.success?200:400,headers:{'Cache-Control':'private,no-store'}});}catch{return NextResponse.json({error:'Session requise.'},{status:401});}}
export async function POST(r:Request){try{sameOrigin(r);await requireUser();const data=await createJojoAiProject(JSON.parse((await limitedBody(r,12000)).toString()));return NextResponse.json(data,{status:data.success?201:400});}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
