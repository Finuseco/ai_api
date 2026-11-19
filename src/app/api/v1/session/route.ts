import {NextResponse} from 'next/server';import {requireUser} from '@/lib/auth';import {generationBalance} from '@/lib/generation-ledger';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireUser();return NextResponse.json({user,credits:await generationBalance(user.id),apiVersion:'v1'},{headers:{'Cache-Control':'private,no-store'}});}catch{return NextResponse.json({error:'Session requise.'},{status:401});}}
