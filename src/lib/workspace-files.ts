import {createHash} from 'node:crypto';
import {db} from './db';
import {requireProject} from './project-access';
import {editablePath,FILE_LIMIT} from './project-files';
import {checkFileQuota} from './file-quota';
export class WorkspaceError extends Error {constructor(message:string,public status=400){super(message);}}
export function fileRevision(content:string,encoding='utf8'){return createHash('sha256').update(JSON.stringify([encoding,content])).digest('hex');}
export async function listWorkspaceFiles(projectId:number){await requireProject(projectId);const {rows}=await db.query('SELECT file_path,file_content,file_encoding FROM jojo_ai_project_files WHERE project_id=$1 ORDER BY file_path',[projectId]);return rows.map(f=>({path:f.file_path,encoding:f.file_encoding,size:Buffer.byteLength(f.file_content,f.file_encoding==='base64'?'base64':'utf8'),revision:fileRevision(f.file_content,f.file_encoding)}));}
export async function readWorkspaceFile(projectId:number,path:string){await requireProject(projectId);editablePath(path);const f=(await db.query('SELECT file_content,file_encoding FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2',[projectId,path])).rows[0];if(!f)throw new WorkspaceError('Fichier introuvable.',404);return {path,content:f.file_content,encoding:f.file_encoding,revision:fileRevision(f.file_content,f.file_encoding)};}
export async function mutateWorkspaceFile(projectId:number,operation:string,input:any){
 await requireProject(projectId);const path=editablePath(input.path),c=await db.getConnection();
 try{await c.query('BEGIN');await c.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[projectId]);
 const row=(await c.query('SELECT * FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2 FOR UPDATE',[projectId,path])).rows[0];
 const destination=operation==='rename'?editablePath(input.target):path;
 if(operation==='create'||operation==='rename'){const paths=(await c.query('SELECT file_path FROM jojo_ai_project_files WHERE project_id=$1',[projectId])).rows.map(f=>f.file_path).filter(p=>operation!=='rename'||p!==path);if(paths.some(p=>p.startsWith(destination+'/')||destination.startsWith(p+'/')))throw new WorkspaceError('Le chemin entre en conflit avec un fichier ou dossier existant.',409);}
 if(operation==='create'){
  if(row)throw new WorkspaceError('Ce fichier existe déjà.',409);
  const content=input.content??'';if(typeof content!=='string'||Buffer.byteLength(content)>FILE_LIMIT)throw new WorkspaceError('Contenu invalide ou trop volumineux.');await checkFileQuota(c,projectId,path,content);
  await c.query('INSERT INTO jojo_ai_project_files(project_id,file_path,file_content) VALUES($1,$2,$3)',[projectId,path,content]);
 }else{
  if(!row)throw new WorkspaceError('Fichier introuvable.',404);
  if(typeof input.revision!=='string'||input.revision!==fileRevision(row.file_content,row.file_encoding))throw new WorkspaceError('Le fichier a changé. Rechargez-le ou comparez avant de réessayer.',409);
  if(operation==='save'){
   if(row.file_encoding!=='utf8')throw new WorkspaceError('Ce fichier binaire ne peut pas être édité comme du texte.',415);
   if(typeof input.content!=='string'||Buffer.byteLength(input.content)>FILE_LIMIT)throw new WorkspaceError('Contenu invalide ou trop volumineux.');await checkFileQuota(c,projectId,path,input.content);
   await c.query('UPDATE jojo_ai_project_files SET file_content=$1 WHERE project_id=$2 AND file_path=$3',[input.content,projectId,path]);
  }else if(operation==='rename'){
   const target=editablePath(input.target);if(target===path)throw new WorkspaceError('Le nouveau chemin doit être différent.');if((await c.query('SELECT id FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2',[projectId,target])).rowCount)throw new WorkspaceError('Le fichier cible existe déjà.',409);
   await c.query('UPDATE jojo_ai_project_files SET file_path=$1 WHERE project_id=$2 AND file_path=$3',[target,projectId,path]);
  }else if(operation==='delete')await c.query('DELETE FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2',[projectId,path]);
  else throw new WorkspaceError('Opération invalide.');
 }
 await c.query('UPDATE jojo_ai_projects SET updated_at=now() WHERE id=$1',[projectId]);await c.query('COMMIT');
 return operation==='delete'?{deleted:true,path}:await readWorkspaceFile(projectId,operation==='rename'?input.target:path);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
