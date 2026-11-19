import {db} from './db';
import {unseal} from './secret-box';
export function githubRepository(raw:string):string {
 const value=raw.trim().replace(/\.git$/,'').replace(/\/$/,'');
 const match=/^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
 if(!match||match[1]==='.'||match[1]==='..'||match[2]==='.'||match[2]==='..')throw Error('Utilisez https://github.com/proprietaire/depot.');
 return `${match[1]}/${match[2]}`;
}
export async function githubToken(userId:number){const {rows}=await db.query('SELECT token_ciphertext FROM jojo_ai_integrations WHERE user_id=$1',[userId]);return rows[0]?unseal(rows[0].token_ciphertext):undefined;}
export async function githubApi(path:string,token?:string,body?:unknown,method?:string){
 const response=await fetch('https://api.github.com'+path,{method:method || (body?'POST':'GET'),headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(response.status===401||response.status===403?'Connexion GitHub refusée. Reconnectez votre compte.':response.status===404?'Dépôt ou branche introuvable.':'GitHub a refusé cette opération. Vérifiez vos droits ou un éventuel conflit.');
 return response.json();
}
