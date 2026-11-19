import {db} from './db';
export async function reserveGeneration(id:string,userId:number,projectId:number,ownKey:boolean){
 const c=await db.getConnection();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`generation:${userId}`]);
  const existing=(await c.query('SELECT status,result,user_id,project_id FROM jojo_ai_generation_runs WHERE id=$1',[id])).rows[0];
  if(existing){if(Number(existing.user_id)!==userId||Number(existing.project_id)!==projectId)throw Error('Demande invalide.');await c.query('ROLLBACK');return {existing:true,result:existing.status==='complete'?existing.result:{success:false,error:existing.status==='reserved'?'Génération déjà en cours.':'Cette génération a échoué. Renvoyez une nouvelle demande.'}};}
  if(Number((await c.query("SELECT COUNT(*)::int AS count FROM jojo_ai_generation_runs WHERE user_id=$1 AND status='reserved'",[userId])).rows[0].count)>0)throw Error('Une génération est déjà en cours sur votre compte.');
  let source='own',day=null;
  if(!ownKey){const daily=await c.query("UPDATE jojo_ai_daily_credits SET remaining=remaining-1 WHERE user_id=$1 AND credit_day=(now() AT TIME ZONE 'UTC')::date AND remaining>=1 RETURNING credit_day",[userId]);
   if(daily.rows[0]){source='daily';day=daily.rows[0].credit_day;}else{const paid=await c.query('UPDATE jojo_ai_credits SET generation_credits=generation_credits-1,updated_at=now() WHERE dev_portal_user_id=$1 AND generation_credits>=1 RETURNING generation_credits',[userId]);if(!paid.rows[0])throw Error('Vos 100 crédits quotidiens sont utilisés. Revenez demain (UTC), ajoutez votre clé API ou utilisez des crédits supplémentaires.');source='paid';}}
  await c.query("INSERT INTO jojo_ai_generation_runs(id,user_id,project_id,status,units,credit_source,credit_day,progress) VALUES($1,$2,$3,'reserved',$4,$5,$6,$7::jsonb)",[id,userId,projectId,ownKey?0:1,source,day,JSON.stringify({stage:'requested',characters:0,files:[]})]);
  await c.query('COMMIT');return {existing:false};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function refundGeneration(id:string){
 const c=await db.getConnection();try{await c.query('BEGIN');
 const row=(await c.query("UPDATE jojo_ai_generation_runs SET status='failed',progress=jsonb_build_object('stage','failed') WHERE id=$1 AND status='reserved' RETURNING user_id,units,credit_source,credit_day",[id])).rows[0];
 if(row?.credit_source==='daily')await c.query('UPDATE jojo_ai_daily_credits SET remaining=LEAST(100,remaining+$1::numeric)::integer WHERE user_id=$2 AND credit_day=$3',[row.units,row.user_id,row.credit_day]);
 else if(row&&row.credit_source!=='own')await c.query('UPDATE jojo_ai_credits SET generation_credits=generation_credits+$1 WHERE dev_portal_user_id=$2',[row.units,row.user_id]);
 await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function generationBalance(userId:number){const row=(await db.query("SELECT c.generation_credits AS extra,COALESCE(d.remaining,0) AS daily FROM jojo_ai_credits c LEFT JOIN jojo_ai_daily_credits d ON d.user_id=c.dev_portal_user_id AND d.credit_day=(now() AT TIME ZONE 'UTC')::date WHERE c.dev_portal_user_id=$1",[userId])).rows[0];return {extra:Number(row?.extra||0),daily:Number(row?.daily||0),total:Number(row?.extra||0)+Number(row?.daily||0)};}
