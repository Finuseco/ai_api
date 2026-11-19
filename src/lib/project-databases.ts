import {Client} from 'pg';
import Cursor from 'pg-cursor';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {requireProject} from './project-access';
import {seal,unseal} from './secret-box';
export async function provisionProjectDatabase(projectId:number, config:{name:string,type:'pg'|'mysql',user:string,pass:string}) {
 let admin:Client|undefined,roleCreated=false,databaseCreated=false;
 const suffix=randomUUID().replaceAll('-','').slice(0,12),name=`jp${projectId}_${suffix}`,role=`ju${projectId}_${suffix}`;
 try {
  await requireProject(projectId,true);
  if(config.type!=='pg')throw new Error('Ce serveur propose PostgreSQL. MySQL nécessite un provisionneur distinct.');
  if(!process.env.PROJECT_DATABASE_ADMIN_URL)throw new Error('Provisionneur PostgreSQL dédié non configuré. Aucune base créée.');
  if(typeof config.pass!=='string'||config.pass.length<16||config.pass.length>128)throw new Error('Le mot de passe doit contenir 16 à 128 caractères.');
  const url=new URL(process.env.PROJECT_DATABASE_ADMIN_URL); url.username=role;url.password=config.pass;url.pathname='/'+name;
  const encrypted=seal(url.toString()); // Validate encryption before provisioning anything.
  admin=new Client({connectionString:process.env.PROJECT_DATABASE_ADMIN_URL,connectionTimeoutMillis:5000});await admin.connect();
  // Names are server-generated identifiers, never interpolated user text.
  const quotedPassword="'"+config.pass.replaceAll("'","''")+"'";
  await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD ${quotedPassword} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 3`);roleCreated=true;
  await admin.query(`ALTER ROLE "${role}" SET statement_timeout='5s'`);
  await admin.query(`ALTER ROLE "${role}" SET idle_in_transaction_session_timeout='10s'`);
  await admin.query(`CREATE DATABASE "${name}" OWNER "${role}"`);databaseCreated=true;
  await admin.query(`REVOKE ALL ON DATABASE "${name}" FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE "${name}" TO "${role}"`);
  await db.query('INSERT INTO project_databases(project_id,name,type,connection_ciphertext) VALUES($1,$2,$3,$4)',[projectId,name,'pg',encrypted]);
  return {success:true,name,user:role};
 } catch(error:any) {
  if(admin){try{if(databaseCreated)await admin.query(`DROP DATABASE "${name}"`);if(roleCreated)await admin.query(`DROP ROLE "${role}"`);}catch{console.error('[DB provision] Nettoyage requis pour la ressource dédiée',name);}}
  return {success:false,error:roleCreated?'Provisionnement interrompu. Vérifiez le service PostgreSQL dédié.':error.message};
 } finally {await admin?.end().catch(()=>{});}
}
export async function queryProjectDatabase(projectId:number,dbId:number,sql:string) {
 let client:Client|undefined;
 try {
  await requireProject(projectId,true);
  if(typeof sql!=='string'||!sql.trim()||Buffer.byteLength(sql)>32000)throw new Error('Requête SQL vide ou trop volumineuse.');
  const {rows}=await db.query('SELECT connection_ciphertext FROM project_databases WHERE id=$1 AND project_id=$2',[dbId,projectId]);
  if(!rows[0]?.connection_ciphertext)throw new Error('Connexion dédiée introuvable.');
  client=new Client({connectionString:unseal(rows[0].connection_ciphertext),connectionTimeoutMillis:5000,query_timeout:6000});await client.connect();
  const cursor=client.query(new Cursor(sql));
  const resultRows=await new Promise<any[]>((resolve,reject)=>cursor.read(101,(error,rows)=>error?reject(error):resolve(rows)));
  await new Promise<void>((resolve,reject)=>cursor.close(error=>error?reject(error):resolve()));
  return {success:true,rows:resultRows.slice(0,100),returnedRows:resultRows.length,truncated:resultRows.length>100,command:'SQL'};
 } catch {return {success:false,error:'Requête refusée ou interrompue. Vérifiez le SQL et la connexion du projet.'};}
 finally {await client?.end().catch(()=>{});}
}
