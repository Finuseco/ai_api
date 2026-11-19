import {db} from './db';
import {requireUser} from './auth';
export async function requireProject(projectId:number, ownerOnly=false) {
  if(!Number.isSafeInteger(projectId)||projectId<1)throw new Error('Projet invalide.');
  const user=await requireUser();
  const {rows}=await db.query(`SELECT p.* FROM jojo_ai_projects p WHERE p.id=$1 AND
    (p.dev_portal_user_id=$2 OR ($3=FALSE AND EXISTS(SELECT 1 FROM project_collaborators c WHERE c.project_id=p.id AND c.user_id=$2 AND c.status='accepted')))`,[projectId,user.id,ownerOnly]);
  if(!rows[0])throw new Error('Projet introuvable ou accès refusé.');
  return {user,project:rows[0],isOwner:Number(rows[0].dev_portal_user_id)===Number(user.id)};
}
