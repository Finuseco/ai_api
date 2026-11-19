import {NextResponse} from 'next/server';import {getChatHistory} from '@/lib/actions/ai.actions';import {requireProject} from '@/lib/project-access';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){try{await requireProject(Number(params.id));return NextResponse.json(await getChatHistory(Number(params.id)),{headers:{'Cache-Control':'private,no-store'}});}catch{return NextResponse.json({error:'Accès refusé.'},{status:403});}}
