import {db} from './db';
import {ProjectFile} from './project-archive';
import {editablePath,excludedPath} from './project-files';
import {requireProject} from './project-access';
export async function storeImportedFiles(projectId:number,files:ProjectFile[],link?:{repository:string;branch:string;sha:string}){
 await requireProject(projectId,true);const client=await db.getConnection();
 try{await client.query('BEGIN');await client.query('SELECT id FROM jojo_ai_projects WHERE id=$1 FOR UPDATE',[projectId]);
 // Import into an empty workspace only. Existing work is never silently overwritten.
 if(Number((await client.query('SELECT COUNT(*)::int AS count FROM jojo_ai_project_files WHERE project_id=$1',[projectId])).rows[0].count)>0)throw Error('Créez un projet vide pour importer le dépôt ou le ZIP sans écraser vos fichiers.');
 for(const f of files)await client.query('INSERT INTO jojo_ai_project_files(project_id,file_path,file_content,file_encoding,file_mode) VALUES($1,$2,$3,$4,$5)',[projectId,f.path,f.content,f.encoding,f.mode||'100644']);
 if(link)await client.query('INSERT INTO jojo_ai_git_links(project_id,repository,branch,base_sha) VALUES($1,$2,$3,$4) ON CONFLICT(project_id) DO UPDATE SET repository=EXCLUDED.repository,branch=EXCLUDED.branch,base_sha=EXCLUDED.base_sha,updated_at=now()',[projectId,link.repository,link.branch,link.sha]);
 await client.query('UPDATE jojo_ai_projects SET updated_at=now() WHERE id=$1',[projectId]);await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function projectFiles(projectId:number){await requireProject(projectId);const {rows}=await db.query('SELECT file_path AS path,file_content AS content,file_encoding AS encoding,file_mode AS mode FROM jojo_ai_project_files WHERE project_id=$1 ORDER BY file_path',[projectId]);return rows.filter(f=>!excludedPath(f.path)).map(f=>({...f,path:editablePath(f.path)})) as ProjectFile[];}
