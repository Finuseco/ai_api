import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {requireUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireUser();if(!process.env.GITHUB_CLIENT_ID||!process.env.GITHUB_CLIENT_SECRET||!process.env.STUDIO_PUBLIC_ORIGIN)throw Error('Connexion GitHub non configurée.');
 const state=randomBytes(32).toString('hex');cookies().set('jojo_github_state',JSON.stringify({state,userId:user.id}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/integrations/github'});
 const url=new URL('https://github.com/login/oauth/authorize');url.searchParams.set('client_id',process.env.GITHUB_CLIENT_ID);url.searchParams.set('redirect_uri',new URL('/api/integrations/github/callback',process.env.STUDIO_PUBLIC_ORIGIN).toString());url.searchParams.set('state',state);url.searchParams.set('scope','repo');return NextResponse.redirect(url);
}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
