import {limitedBody} from './http-limits';
export async function runtimeRunner(path:string,method='GET',body?:unknown){
 if(!process.env.RUNTIME_RUNNER_URL||!process.env.RUNTIME_RUNNER_TOKEN)throw Error('Le worker d’exécution/hébergement n’est pas configuré.');
 const base=new URL(process.env.RUNTIME_RUNNER_URL);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Le worker distant doit utiliser HTTPS.');
 const r=await fetch(new URL(path,base),{method,headers:{Authorization:`Bearer ${process.env.RUNTIME_RUNNER_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});const data=JSON.parse((await limitedBody(r,6*1024*1024)).toString('utf8'));if(!r.ok)throw Error(data.error||'Le worker est indisponible.');return data;
}
