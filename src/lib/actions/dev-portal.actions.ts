'use server';

import {generationBalance} from '../generation-ledger';
import {createHash} from 'node:crypto';
import { db } from '../db';
import {provisionProjectDatabase,queryProjectDatabase} from '../project-databases';
import {studioSession} from '../auth';
import {requireProject} from '../project-access';
import {checkFileQuota} from '../file-quota';
import {starterFiles} from '../project-starters';
import {editablePath, FILE_LIMIT} from '../project-files';
import type { DevPortalUser } from '@/lib/types';
import { cookies } from 'next/headers';
import { verifyToken } from '../jwt';
import { revalidatePath } from 'next/cache';

/**
 * Récupère ou synchronise la session utilisateur Elite via cookies.
 */
export async function getJojoAiSession(providedToken?: string) {
    try { return await studioSession(providedToken); } catch {return {success:false as const};}
}

/**
 * Liste les projets de l'utilisateur (Possédés + Partagés).
 */
export async function getProjectsForUser() {
    try {
        const session = await getJojoAiSession();
        if (!session.success || !session.user) return { success: false };

        // Requête robuste gérant l'absence potentielle de la table pc
        const { rows } = await db.query(`
            SELECT p.*, u.manager_name as owner_name,
            CASE WHEN p.dev_portal_user_id = $1 THEN 'owner' ELSE 'collaborator' END as user_role
            FROM jojo_ai_projects p
            LEFT JOIN dev_portal_users u ON p.dev_portal_user_id = u.id
            LEFT JOIN (
                SELECT project_id, user_id FROM project_collaborators WHERE status = 'accepted'
            ) pc ON p.id = pc.project_id
            WHERE p.dev_portal_user_id = $1 OR pc.user_id = $1
            ORDER BY p.updated_at DESC
        `, [session.user.id]);

        return { success: true, projects: rows };
    } catch (e: any) {
        console.error('getProjectsForUser query error:', e);
        return {success:false,error:"Impossible de lire les projets. Vérifiez la connexion et les migrations PostgreSQL."};
    }
}

/**
 * Invite un collaborateur sur un projet via son e-mail.
 */
export async function inviteCollaborator(projectId: number, email: string) {
    try {
        await requireProject(projectId,true);
        const session = await getJojoAiSession();
        if (!session.success || !session.user) throw new Error("Auth requise.");

        const { rows: userRows } = await db.query('SELECT id FROM dev_portal_users WHERE email = $1', [email]);
        if (userRows.length === 0) throw new Error("Utilisateur introuvable.");

        const targetUserId = userRows[0].id;

        await db.query(`
            INSERT INTO project_collaborators (project_id, user_id, role, status)
            VALUES ($1, $2, 'collaborator', 'pending')
            ON CONFLICT (project_id, user_id) DO NOTHING
        `, [projectId, targetUserId]);

        return { success: true };
    } catch (e: any) {
        console.error('inviteCollaborator error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Création d'un projet avec architecture complète.
 */
export async function createJojoAiProject(data: { name: string, description: string, template: string }) {
    const connection = await db.getConnection();
    try {
        const session = await getJojoAiSession();
        if (!session.success || !session.user) throw new Error("Authentification Elite requise.");

        if(typeof data.name!=='string'||!data.name.trim()||data.name.length>120||typeof data.description!=='string'||data.description.length>5000||!['empty','android','react','react-native','web','music','video','fintech','ecommerce'].includes(data.template))throw new Error('Nom ou description invalide.');
        await connection.query('BEGIN');
        await connection.query('SELECT id FROM dev_portal_users WHERE id=$1 FOR UPDATE',[session.user.id]);
        if(Number((await connection.query('SELECT COUNT(*)::int AS count FROM jojo_ai_projects WHERE dev_portal_user_id=$1',[session.user.id])).rows[0].count)>=50)throw new Error('Limite de 50 projets atteinte.');
        const { rows } = await connection.query(
            'INSERT INTO jojo_ai_projects (dev_portal_user_id, name, description, app_template) VALUES ($1, $2, $3, $4) RETURNING id',
            [session.user.id, data.name, data.description, data.template]
        );
        const pid = rows[0].id;

        const defaultFiles = data.template === 'empty' ? [] : starterFiles(data.name, data.template);
        for (const file of defaultFiles) {
            await connection.query(
                'INSERT INTO jojo_ai_project_files (project_id, file_path, file_content) VALUES ($1, $2, $3)',
                [pid, file.path, file.content]
            );
        }

        await connection.query('COMMIT');
        return { success: true, data: { projectId: pid, appName: data.name } };
    } catch (e: any) {
        console.error('createJojoAiProject error:', e);
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

/**
 * Récupère l'arborescence complète des fichiers du projet.
 */
export async function getProjectFileTree(projectId: number) {
    try {
        await requireProject(projectId);
        const { rows } = await db.query('SELECT file_path FROM jojo_ai_project_files WHERE project_id = $1 ORDER BY file_path ASC', [projectId]);
        return { success: true, files: rows.map(r => r.file_path) };
    } catch (e) {
        console.error('getProjectFileTree error:', e);
        return { success: false, files: [] };
    }
}

/**
 * Récupère le contenu d'un fichier spécifique.
 */
export async function getFileContent(projectId: number, filePath: string) {
    try {
        await requireProject(projectId); editablePath(filePath);
        const { rows } = await db.query('SELECT file_content,file_encoding FROM jojo_ai_project_files WHERE project_id = $1 AND file_path = $2', [projectId, filePath]);
        if(!rows[0])throw new Error('Fichier introuvable.');
        if(Buffer.byteLength(rows[0].file_content)>512*1024)throw new Error('Ce fichier dépasse la limite de l’éditeur (512 Ko). Utilisez l’export ZIP.');
        if(rows[0]?.file_encoding==='base64')throw new Error('Fichier binaire : disponible dans l’export ZIP.');
        return { success: true, content: rows[0]?.file_content || '' };
    } catch (e:any) {
        return { success: false, content: '', error:e.message };
    }
}

export async function saveFileContent(projectId:number,filePath:string,content:string){
 let c;
 try{await requireProject(projectId);editablePath(filePath);if(typeof content!=='string'||Buffer.byteLength(content)>FILE_LIMIT)throw Error('Fichier trop volumineux.');c=await db.getConnection();await c.query('BEGIN');await checkFileQuota(c,projectId,filePath,content);const changed=await c.query("UPDATE jojo_ai_project_files SET file_content=$1 WHERE project_id=$2 AND file_path=$3 AND file_encoding='utf8'",[content,projectId,filePath]);if(!changed.rowCount)throw Error('Fichier texte introuvable.');await c.query('UPDATE jojo_ai_projects SET updated_at=now() WHERE id=$1',[projectId]);await c.query('COMMIT');return {success:true};}
 catch(e:any){await c?.query('ROLLBACK');return {success:false,error:e.message};}finally{c?.release();}
}

export async function getPendingActions(projectId: number) {
    try {
        await requireProject(projectId);
        const { rows } = await db.query("SELECT * FROM project_pending_actions WHERE project_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 100", [projectId]);
        return { success: true, actions: rows };
    } catch (e) {
        console.error('getPendingActions error:', e);
        return { success: false, actions: [] };
    }
}

async function applyProposal(connection:any,action:any){
 await checkFileQuota(connection,Number(action.project_id),action.file_path,action.content,action.file_encoding||'utf8');
 const current=(await connection.query('SELECT file_content FROM jojo_ai_project_files WHERE project_id=$1 AND file_path=$2',[action.project_id,action.file_path])).rows[0];
 const currentHash=current?createHash('sha256').update(current.file_content).digest('hex'):'absent';
 if(!action.base_hash||currentHash!==action.base_hash)throw Error('Un fichier a changé depuis la proposition. Rejetez-la puis demandez une nouvelle génération.');
 if(action.status!=='pending')throw Error('Action déjà traitée.');editablePath(action.file_path);
 const encoding=action.file_encoding||'utf8';if(!['utf8','base64'].includes(encoding)||Buffer.byteLength(action.content,encoding==='base64'?'base64':'utf8')>FILE_LIMIT)throw Error('Fichier trop volumineux ou encodage invalide.');
 await connection.query(`INSERT INTO jojo_ai_project_files(project_id,file_path,file_content,file_encoding) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,file_path) DO UPDATE SET file_content=EXCLUDED.file_content,file_encoding=EXCLUDED.file_encoding`,[action.project_id,action.file_path,action.content,encoding]);
 await connection.query("UPDATE project_pending_actions SET status='approved' WHERE id=$1",[action.id]);
 await connection.query('UPDATE jojo_ai_projects SET updated_at=now() WHERE id=$1',[action.project_id]);
}
export async function approvePendingAction(actionId:number){let c;try{
 c=await db.getConnection();await c.query('BEGIN');const action=(await c.query('SELECT * FROM project_pending_actions WHERE id=$1 FOR UPDATE',[actionId])).rows[0];if(!action)throw Error('Action introuvable.');await requireProject(Number(action.project_id));await applyProposal(c,action);await c.query('COMMIT');return {success:true};
}catch(e:any){await c?.query('ROLLBACK');return {success:false,error:e.message};}finally{c?.release();}}
export async function approveAllPendingActions(projectId:number){let c;try{
 await requireProject(projectId);c=await db.getConnection();await c.query('BEGIN');
 const actions=(await c.query("SELECT * FROM project_pending_actions WHERE project_id=$1 AND status='pending' ORDER BY id FOR UPDATE",[projectId])).rows;
 for(const action of actions)await applyProposal(c,action);await c.query('COMMIT');return {success:true,count:actions.length};
}catch(e:any){await c?.query('ROLLBACK');return {success:false,error:e.message};}finally{c?.release();}}

export async function rejectPendingAction(actionId: number) {
    try { const found=await db.query('SELECT project_id FROM project_pending_actions WHERE id=$1',[actionId]);if(!found.rows[0])throw new Error('Action introuvable.');await requireProject(Number(found.rows[0].project_id));

        await db.query("UPDATE project_pending_actions SET status = 'rejected' WHERE id = $1", [actionId]);
        return { success: true };
    } catch (e) {
        console.error('rejectPendingAction error:', e);
        return { success: false };
    }
}

export async function getCredits() {
    try {
        const session = await getJojoAiSession();
        if (!session.success || !session.user) return { success: false, credits: 0 };
        const balance=await generationBalance(session.user.id);return {success:true,credits:balance.total,daily:balance.daily,extra:balance.extra};
    } catch (e) {
        console.error('getCredits error:', e);
        return { success: false, credits: 0 };
    }
}

export async function deleteProject(projectId: number) {
    try {
        await requireProject(projectId,true);
        if((await db.query('SELECT id FROM project_databases WHERE project_id=$1 LIMIT 1',[projectId])).rowCount)throw Error('Supprimez d’abord les bases dédiées avec votre administrateur.');
        await db.query('DELETE FROM jojo_ai_projects WHERE id = $1', [projectId]);
        return { success: true };
    } catch (e) {
        console.error('deleteProject error:', e);
        return { success: false };
    }
}

export async function getProjectDatabases(projectId: number) {
    try {
        await requireProject(projectId,true);
        const { rows } = await db.query('SELECT id,project_id,name,type,manager_url,created_at FROM project_databases WHERE project_id = $1', [projectId]);
        return { success: true, databases: rows };
    } catch (e) {
        console.error('getProjectDatabases error:', e);
        return { success: false, databases: [] };
    }
}

export async function provisionNewDatabase(projectId:number,config:{name:string,type:'pg'|'mysql',user:string,pass:string}) {
    return provisionProjectDatabase(projectId,config);
}
export async function runSqlQuery(projectId:number,dbId:number,sql:string) {
    return queryProjectDatabase(projectId,dbId,sql);
}

export async function toggleProjectVisibility(projectId: number, isPublic: boolean) {
    try {
        await requireProject(projectId,true);
        await db.query('UPDATE jojo_ai_projects SET is_public = $1 WHERE id = $2', [isPublic, projectId]);
        return { success: true };
    } catch (e: any) {
        console.error('toggleProjectVisibility error:', e);
        return { success: false, error: e.message };
    }
}

export async function createFileSystemItem(projectId:number,path:string,type:'file'|'folder'){
 let c;try{await requireProject(projectId);if(!['file','folder'].includes(type))throw Error('Type invalide.');const finalPath=editablePath(type==='folder'?path+'/.gitkeep':path);c=await db.getConnection();await c.query('BEGIN');await checkFileQuota(c,projectId,finalPath,'');const result=await c.query('INSERT INTO jojo_ai_project_files(project_id,file_path,file_content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[projectId,finalPath,'']);if(!result.rowCount)throw Error('Le fichier existe déjà.');await c.query('COMMIT');return {success:true};}catch(e:any){await c?.query('ROLLBACK');return {success:false,error:e.message};}finally{c?.release();}
}

export async function triggerBuild(projectId:number) {
    try {await requireProject(projectId);return {success:false,error:"Lancez la compilation depuis le panneau Exécution : un worker isolé doit être configuré."};}
    catch {return {success:false,error:"Accès refusé."};}
}

export async function getProjectInvitations(){try{const s=await studioSession();if(!s.success||!s.user)throw Error('Session requise.');const {rows}=await db.query("SELECT c.id,p.name FROM project_collaborators c JOIN jojo_ai_projects p ON p.id=c.project_id WHERE c.user_id=$1 AND c.status='pending'",[s.user.id]);return {success:true,invitations:rows};}catch{return {success:false,invitations:[]};}}
export async function respondToProjectInvitation(id:number,accept:boolean){try{const s=await studioSession();if(!s.success||!s.user)throw Error('Session requise.');const r=await db.query("UPDATE project_collaborators SET status=$1,accepted_at=CASE WHEN $1='accepted' THEN now() ELSE NULL END WHERE id=$2 AND user_id=$3 AND status='pending'",[accept?'accepted':'rejected',id,s.user.id]);return {success:r.rowCount===1};}catch{return {success:false};}}
