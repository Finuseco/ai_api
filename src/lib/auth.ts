import {cookies} from 'next/headers';
import {db} from './db';
import {verifyToken} from './jwt';
import type {DevPortalUser} from './types';
export async function studioSession(providedToken?:string) {
  const token=providedToken || cookies().get('dev_portal_token')?.value;
  if(!token)return {success:false as const};
  const decoded=verifyToken(token);
  if(!decoded)return {success:false as const};
  const {rows}=await db.query('SELECT id,username,email,manager_name,company_name,phone,b2b_user_id FROM dev_portal_users WHERE id=$1',[decoded.id]);
  if(!rows[0])return {success:false as const};
  const initial=Number(process.env.JOJO_INITIAL_CREDITS ?? '0');
  if(!Number.isFinite(initial)||initial<0)throw new Error('Configuration des crédits initiaux invalide.');
  await db.query('INSERT INTO jojo_ai_credits(dev_portal_user_id,generation_credits) VALUES($1,$2) ON CONFLICT(dev_portal_user_id) DO NOTHING',[decoded.id,initial]);
  await db.query("INSERT INTO jojo_ai_daily_credits(user_id,credit_day,remaining) VALUES($1,(now() AT TIME ZONE 'UTC')::date,100) ON CONFLICT(user_id,credit_day) DO NOTHING",[decoded.id]);
  if(providedToken)cookies().set('dev_portal_token',providedToken,{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:604800});
  return {success:true as const,user:rows[0] as DevPortalUser};
}
export async function requireUser(){const session=await studioSession();if(!session.success||!session.user)throw new Error('Authentification requise.');return session.user;}
