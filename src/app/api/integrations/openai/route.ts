import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {seal} from '@/lib/secret-box';
import {sameOrigin,limitedBody} from '@/lib/http-limits';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireUser();const own=Boolean((await db.query('SELECT user_id FROM jojo_ai_openai_accounts WHERE user_id=$1',[user.id])).rows[0]);return NextResponse.json({ownKey:own,sharedConfigured:Boolean(process.env.OPENAI_API_KEY),codingModel:process.env.OPENAI_CODEX_MODEL||null,imageModel:process.env.OPENAI_IMAGE_MODEL||null},{headers:{'Cache-Control':'private,no-store'}});}catch{return NextResponse.json({error:'Session requise.'},{status:401});}}
export async function POST(request:Request){try{sameOrigin(request);const user=await requireUser();const input=JSON.parse((await limitedBody(request,2000)).toString('utf8'));if(input.action==='remove'){await db.query('DELETE FROM jojo_ai_openai_accounts WHERE user_id=$1',[user.id]);return NextResponse.json({success:true});}if(typeof input.apiKey!=='string'||!/^sk-[A-Za-z0-9_-]{16,500}$/.test(input.apiKey))throw Error('Format de clé API OpenAI invalide.');await db.query('INSERT INTO jojo_ai_openai_accounts(user_id,key_ciphertext) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET key_ciphertext=EXCLUDED.key_ciphertext,updated_at=now()',[user.id,seal(input.apiKey)]);return NextResponse.json({success:true});}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
