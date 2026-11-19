import {readArchive} from './project-archive';
import {limitedBody} from './http-limits';
export async function githubArchive(repository:string,sha:string,token?:string){
 if(!/^[a-f0-9]{40,64}$/.test(sha))throw Error('Révision GitHub invalide.');
 let target=`https://api.github.com/repos/${repository}/zipball/${sha}`,download:Response|undefined;
 for(let n=0;n<3;n++){
  const url=new URL(target);
  if(url.protocol!=='https:'||!['api.github.com','codeload.github.com'].includes(url.hostname)||url.port)throw Error('Destination GitHub refusée.');
  download=await fetch(url,{headers:url.hostname==='api.github.com'&&token?{Authorization:`Bearer ${token}`}:{},redirect:'manual',signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(![301,302,307,308].includes(download.status))break;
  target=new URL(download.headers.get('location')||'',url).toString();
 }
 if(!download?.ok)throw Error('Impossible de télécharger cette archive GitHub.');
 return readArchive(await limitedBody(download,20*1024*1024),true);
}
