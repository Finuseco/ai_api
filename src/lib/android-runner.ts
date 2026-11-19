export async function androidRunner(path:string,method='GET',body?:BodyInit,contentType='application/json'){
 const endpoint=process.env.ANDROID_RUNNER_URL,token=process.env.ANDROID_RUNNER_TOKEN;
 if(!endpoint||!token)throw Error('Le worker Android réel n’est pas configuré.');
 const base=new URL(endpoint);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Le worker distant doit utiliser HTTPS.');
 const response=await fetch(new URL(path,base),{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000)});const data=await response.json();
 if(!response.ok)throw Error(data.error||'Le worker Android est indisponible.');
 if(data.session?.viewerUrl){const url=new URL(data.session.viewerUrl);const allowed=new URL(process.env.ANDROID_PUBLIC_ORIGIN||'');if(url.origin!==allowed.origin||!url.pathname.startsWith(allowed.pathname.replace(/\/$/,'')+'/view/'))throw Error('Adresse de vue Android refusée.');}
 return data;
}
