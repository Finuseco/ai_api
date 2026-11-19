import type {PoolClient} from 'pg';
import {COUNT_LIMIT,TOTAL_LIMIT} from './project-files';
export async function checkFileQuota(connection:PoolClient,projectId:number,path:string,content:string,encoding='utf8'){
 await connection.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[projectId]);
 const stats=(await connection.query(`SELECT COUNT(*)::int AS count,COALESCE(SUM(CASE WHEN file_encoding='base64' THEN octet_length(file_content)*3/4 ELSE octet_length(file_content) END),0)::bigint AS bytes FROM jojo_ai_project_files WHERE project_id=$1 AND file_path<>$2`,[projectId,path])).rows[0];
 if(Number(stats.count)>=COUNT_LIMIT||Number(stats.bytes)+Buffer.byteLength(content,encoding==='base64'?'base64':'utf8')>TOTAL_LIMIT)throw Error('Quota de fichiers du projet atteint.');
}
