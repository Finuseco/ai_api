import {db} from './db';
import {unseal} from './secret-box';
export async function openaiSettings(userId:number){
 const account=(await db.query('SELECT key_ciphertext FROM jojo_ai_openai_accounts WHERE user_id=$1',[userId])).rows[0];
 const apiKey=account?unseal(account.key_ciphertext):process.env.OPENAI_API_KEY;
 if(!apiKey)throw Error('Ajoutez votre clé API OpenAI ou demandez l’activation du compte partagé JoJo AI.');
 if(!process.env.OPENAI_CODEX_MODEL)throw Error('Le modèle de codage OpenAI doit être configuré côté serveur.');
 return {apiKey,model:process.env.OPENAI_CODEX_MODEL,ownKey:Boolean(account)};
}
