'use server';

import crypto from 'crypto';

/**
 * @fileOverview Service d'intégration cPanel UAPI pour JOJO AI Studio.
 * Supporte MariaDB/MySQL et PostgreSQL avec configuration d'accès distant et identifiants personnalisés.
 */

const CPANEL_API_TOKEN = process.env.CPANEL_API_TOKEN;
const CPANEL_USER = process.env.CPANEL_USER;
const CPANEL_URL = process.env.CPANEL_URL; 
const CPANEL_DB_PREFIX = process.env.CPANEL_DB_PREFIX || 'jojo_';

async function cpanelApiCall(module: string, func: string, params: Record<string, string | number>): Promise<any> {
    if (!CPANEL_API_TOKEN || !CPANEL_URL || !CPANEL_USER) {
        throw new Error('Service cPanel non configuré.');
    }

    const searchParams = new URLSearchParams();
    for (const key in params) {
        searchParams.append(key, String(params[key]));
    }

    const apiUrl = `${CPANEL_URL}/execute/${module}/${func}?${searchParams.toString()}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Authorization': `cpanel ${CPANEL_USER}:${CPANEL_API_TOKEN}` }
        });
        const data = await response.json();
        if (data.errors) throw new Error(data.errors[0]);
        return data;
    } catch (error: any) {
        console.error(`[cPanel API Error]`, error);
        throw new Error(`cPanel API call failed: ${error.message}`);
    }
}

/**
 * Provisionne une base de données avec des identifiants personnalisés.
 */
export async function provisionDatabase(name: string, type: 'pg' | 'mysql' = 'pg', user: string, pass: string): Promise<any> {
    const dbName = `${CPANEL_DB_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const dbUser = `${CPANEL_DB_PREFIX}${user.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const dbModule = type === 'pg' ? 'Postgresql' : 'Mysql';

    try {
        // 1. Création de la DB
        await cpanelApiCall(dbModule, 'create_database', { db: dbName });
        
        // 2. Création de l'utilisateur avec le mot de passe fourni
        await cpanelApiCall(dbModule, 'create_user', { user: dbUser, password: pass });
        
        // 3. Attribution des privilèges
        if (type === 'pg') {
            await cpanelApiCall(dbModule, 'set_privileges_on_database', { database: dbName, user: dbUser, 'privileges.ALL': 1 });
        } else {
            await cpanelApiCall(dbModule, 'set_privileges_on_database', { db: dbName, user: dbUser, privileges: 'ALL PRIVILEGES' });
        }

        // Host par défaut
        const host = '127.0.0.1';
        const port = type === 'pg' ? 5432 : 3306;
        const url = type === 'pg' 
            ? `postgresql://${dbUser}:${pass}@${host}:${port}/${dbName}`
            : `mysql://${dbUser}:${pass}@${host}:${port}/${dbName}`;

        return { success: true, dbName, dbUser, url, type };
    } catch (e: any) {
        console.error('cPanel provisionDatabase error:', e);
        return { success: false, error: e.message };
    }
}

export async function getDbManagerUrl(type: 'pg' | 'mysql'): Promise<string> {
    const base = `https://${CPANEL_USER}.cashpay-all.com/db-admin`;
    const params = new URLSearchParams({
        engine: type === 'pg' ? 'pgsql' : 'server',
        db: '',
        ext: 'jojo-elite'
    });
    return `${base}/adminer.php?${params.toString()}`;
}
