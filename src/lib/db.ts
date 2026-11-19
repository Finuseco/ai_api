import { Pool } from 'pg';

let pool: Pool | undefined;
function database(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL && (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER)) {
      throw new Error('PostgreSQL non configuré. Renseignez DATABASE_URL ou DB_HOST/DB_NAME/DB_USER.');
    }
    pool = new Pool({
      ...(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {
        host:process.env.DB_HOST, database:process.env.DB_NAME, user:process.env.DB_USER,
        password:process.env.DB_PASSWORD, port:Number(process.env.DB_PORT || 5432),
      }),
      ...(process.env.DB_SSL_CA ? {ssl:{ca:process.env.DB_SSL_CA,rejectUnauthorized:true}} : {}),
      max:10, connectionTimeoutMillis:5000, query_timeout:15000,
    });
    pool.on('error', () => console.error('[PostgreSQL] Connexion interrompue. Aucun stockage de remplacement utilisé.'));
  }
  return pool;
}
export const db = {
  query:(sql:string, params?:any[])=>database().query(sql,params),
  getConnection:()=>database().connect(),
};
