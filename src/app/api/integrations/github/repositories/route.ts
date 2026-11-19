import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {githubToken,githubApi} from '@/lib/github';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await requireUser(),token=await githubToken(user.id);
 if(!token)throw Error('Connectez GitHub pour parcourir vos dépôts.');
 const page=Number(new URL(request.url).searchParams.get('page')||1);
 if(!Number.isInteger(page)||page<1||page>100)throw Error('Page invalide.');
 const data=await githubApi(`/user/repos?sort=updated&per_page=50&page=${page}`,token);
 return NextResponse.json({repositories:data.map((r:any)=>({name:r.full_name,private:r.private,branch:r.default_branch,canPush:Boolean(r.permissions?.push)})),hasMore:data.length===50},{headers:{'Cache-Control':'private,no-store'}});
}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
