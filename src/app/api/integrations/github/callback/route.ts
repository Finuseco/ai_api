import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {seal} from '@/lib/secret-box';
import {githubApi} from '@/lib/github';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await requireUser(),url=new URL(request.url),raw=cookies().get('jojo_github_state')?.value;cookies().delete('jojo_github_state');
 const state=raw?JSON.parse(raw):null;if(!state||state.userId!==user.id||state.state!==url.searchParams.get('state')||!url.searchParams.get('code'))throw Error('Session GitHub expirée ou état invalide.');
 const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:new URL('/api/integrations/github/callback',process.env.STUDIO_PUBLIC_ORIGIN!).toString()}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const token=await response.json();if(!response.ok||!token.access_token)throw Error('GitHub a refusé la connexion.');const identity=await githubApi('/user',token.access_token);
 await db.query('INSERT INTO jojo_ai_integrations(user_id,github_login,token_ciphertext) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET github_login=EXCLUDED.github_login,token_ciphertext=EXCLUDED.token_ciphertext,updated_at=now()',[user.id,identity.login,seal(token.access_token)]);
 return NextResponse.redirect(new URL('/?github=connected',process.env.STUDIO_PUBLIC_ORIGIN));
}catch{return NextResponse.json({error:'Connexion GitHub non terminée. Reconnectez-vous depuis le studio.'},{status:400});}}
