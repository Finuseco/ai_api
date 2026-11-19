'use strict';
// Run only on a dedicated KVM-capable worker. This service never executes project source on its host.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const exec=promisify(execFile);
const key=process.env.ANDROID_RUNNER_TOKEN,viewKey=process.env.ANDROID_VIEW_SECRET;
if(!key||key.length<32||!viewKey||viewKey.length<32)throw Error('Deux secrets de worker distincts, de 32 caractères minimum, sont requis.');
const publicUrl=new URL(process.env.ANDROID_PUBLIC_ORIGIN||'http://127.0.0.1:8788');
const base=publicUrl.pathname.replace(/\/$/,''),sessions=new Map(),usedTickets=new Map();let creating=false;
const origin=new URL(process.env.STUDIO_PUBLIC_ORIGIN||'http://localhost:3000').origin;
function sign(data){const raw=Buffer.from(JSON.stringify(data)).toString('base64url');return raw+'.'+crypto.createHmac('sha256',viewKey).update(raw).digest('base64url');}
function verify(value){const [raw,sig]=String(value||'').split('.');const expected=crypto.createHmac('sha256',viewKey).update(raw||'').digest('base64url');if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw Error('Accès refusé.');const data=JSON.parse(Buffer.from(raw,'base64url'));if(data.exp<Date.now())throw Error('Accès expiré.');return data;}
function apiAuth(req){const token=(req.headers.authorization||'').replace(/^Bearer /,'');return token.length===key.length&&crypto.timingSafeEqual(Buffer.from(token),Buffer.from(key));}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req,max){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('Fichier trop volumineux.');chunks.push(chunk);}return Buffer.concat(chunks);}
async function docker(args,timeout=15000){return (await exec('docker',args,{timeout,maxBuffer:128*1024})).stdout.trim();}
function owned(id,userId,projectId){const s=sessions.get(id);if(!s||s.userId!==Number(userId)||s.projectId!==Number(projectId))throw Error('Session introuvable.');return s;}
function snapshot(s){const ticket=sign({sid:s.id,exp:Date.now()+60000,nonce:crypto.randomUUID()});return {id:s.id,status:s.status,expiresAt:new Date(s.expires).toISOString(),viewerUrl:publicUrl.origin+base+'/view/'+s.id+'/?ticket='+encodeURIComponent(ticket),error:s.error};}
async function remove(s){sessions.delete(s.id);await docker(['rm','-f',s.name]).catch(()=>{});}
function normalized(req){let p=new URL(req.url,'http://worker').pathname;if(base&&p.startsWith(base+'/'))p=p.slice(base.length);return p;}
function viewer(req){const p=normalized(req),match=/^\/view\/([a-f0-9-]{36})(\/.*)?$/.exec(p);if(!match)throw Error('Vue introuvable.');const s=sessions.get(match[1]);if(!s||s.expires<Date.now())throw Error('Session expirée.');const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('jojo_view_'+s.id+'='))?.split('=').slice(1).join('=');const data=verify(cookie);if(data.sid!==s.id)throw Error('Vue refusée.');return {s,target:match[2]||'/vnc.html'};}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://worker'),p=normalized(req);
 if(p==='/healthz'){let kvm=true;await fs.access('/dev/kvm').catch(()=>kvm=false);return json(res,200,{status:'ok',kvm});}
 if(p.startsWith('/view/')){
  const id=p.split('/')[2],s=sessions.get(id);if(!s)throw Error('Session introuvable.');
  const ticket=url.searchParams.get('ticket');
  if(ticket){const data=verify(ticket);if(data.sid!==id||usedTickets.has(data.nonce))throw Error('Ticket déjà utilisé.');usedTickets.set(data.nonce,data.exp);
   const cookie=sign({sid:id,exp:s.expires});const wsPath=base+'/view/'+id+'/websockify';
   res.writeHead(303,{'Location':base+'/view/'+id+'/vnc.html?autoconnect=1&resize=scale&path='+encodeURIComponent(wsPath),'Referrer-Policy':'no-referrer','Set-Cookie':`jojo_view_${id}=${cookie}; Path=${base}/view/${id}/; HttpOnly; SameSite=Lax; Max-Age=1800${publicUrl.protocol==='https:'?'; Secure':''}`,'Cache-Control':'no-store'});return res.end();
  }
  const view=viewer(req);if(!['GET','HEAD'].includes(req.method))throw Error('Méthode refusée.');
  const upstream=http.request({hostname:'127.0.0.1',port:view.s.port,path:view.target+url.search,method:req.method,headers:{host:'localhost:'+view.s.port,accept:req.headers.accept||'*/*'}},reply=>{
   res.writeHead(reply.statusCode,{'Content-Type':reply.headers['content-type']||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`frame-ancestors ${origin}`});reply.pipe(res);
  });upstream.on('error',()=>{if(!res.headersSent)json(res,502,{error:'Écran Android en démarrage.'});else res.destroy();});upstream.end();return;
 }
 if(!apiAuth(req))return json(res,401,{error:'Authentification du worker requise.'});
 if(p==='/v1/sessions'&&req.method==='GET'){
  const s=[...sessions.values()].find(s=>s.userId===Number(url.searchParams.get('userId'))&&s.projectId===Number(url.searchParams.get('projectId')));return json(res,200,{configured:true,session:s?snapshot(s):null});
 }
 if(p==='/v1/sessions'&&req.method==='POST'){
  const data=JSON.parse(await body(req,4096));if(!Number.isSafeInteger(data.userId)||!Number.isSafeInteger(data.projectId)||data.userId<1||data.projectId<1)throw Error('Identité invalide.');
  const existing=[...sessions.values()].find(s=>s.userId===data.userId&&s.projectId===data.projectId);if(existing)return json(res,200,{session:snapshot(existing)});
  if(creating||sessions.size>=Number(process.env.ANDROID_MAX_SESSIONS||2)||[...sessions.values()].some(s=>s.userId===data.userId))throw Error('Capacité Android atteinte. Arrêtez votre autre session.');
  await fs.access('/dev/kvm').catch(()=>{throw Error('KVM indisponible : ce worker ne peut pas démarrer Android.');});if(creating)throw Error('Un démarrage est déjà en cours.');creating=true;
  const s={id:crypto.randomUUID(),userId:data.userId,projectId:data.projectId,status:'booting',expires:Date.now()+30*60000};s.name='jojo-android-'+s.id;
  try{await docker(['run','-d','--name',s.name,'--label','jojo.android=1','--device','/dev/kvm','--cpus','2','--memory','3g','--pids-limit','512','--security-opt','no-new-privileges','-p','127.0.0.1::6080','-e','EMULATOR_DEVICE=Samsung Galaxy S10','-e','WEB_VNC=true',process.env.ANDROID_IMAGE||'budtmo/docker-android:emulator_14.0'],120000);
   const mapping=await docker(['port',s.name,'6080/tcp']);s.port=Number(mapping.match(/:(\d+)$/)?.[1]);if(!s.port)throw Error('Port Android indisponible.');sessions.set(s.id,s);json(res,202,{session:snapshot(s)});
  }catch{await docker(['rm','-f',s.name]).catch(()=>{});throw Error('Démarrage Android impossible. Vérifiez l’image téléchargée et les ressources KVM.');}finally{creating=false;}return;
 }
 const match=/^\/v1\/sessions\/([a-f0-9-]{36})(\/apk)?$/.exec(p);
 if(match){const s=owned(match[1],url.searchParams.get('userId'),url.searchParams.get('projectId'));
  if(req.method==='DELETE'){await remove(s);return json(res,200,{success:true});}
  if(req.method==='POST'&&match[2]){
   const bytes=await body(req,25*1024*1024);if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('APK Android invalide.');
   const temp=await fs.mkdtemp(path.join(os.tmpdir(),'jojo-apk-'));try{await fs.writeFile(path.join(temp,'app.apk'),bytes);await docker(['cp',path.join(temp,'app.apk'),s.name+':/tmp/jojo-app.apk']);const output=await docker(['exec',s.name,'adb','-s','emulator-5554','install','-r','/tmp/jojo-app.apk'],90000);if(!output.includes('Success'))throw Error('Installation refusée.');return json(res,200,{success:true});}finally{await fs.rm(temp,{recursive:true,force:true});await docker(['exec',s.name,'rm','-f','/tmp/jojo-app.apk']).catch(()=>{});}
  }
 }
 json(res,404,{error:'Route inconnue.'});
}catch(error){if(!res.headersSent)json(res,400,{error:error.message});else res.destroy();}});
server.on('upgrade',(req,socket,head)=>{try{const {s,target}=viewer(req);if(target!=='/websockify')throw Error();
 const headers={...req.headers,host:'localhost:'+s.port};delete headers.cookie;delete headers.authorization;
 const upstream=http.request({hostname:'127.0.0.1',port:s.port,path:'/websockify',headers});
 upstream.on('upgrade',(reply,remote,buffer)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\n'+reply.rawHeaders.reduce((out,v,i,a)=>i%2?out:out+a[i]+': '+a[i+1]+'\r\n','')+'\r\n');if(buffer.length)socket.write(buffer);if(head.length)remote.write(head);socket.pipe(remote).pipe(socket);const timer=setTimeout(()=>{socket.destroy();remote.destroy();},Math.max(1,s.expires-Date.now()));socket.on('close',()=>{clearTimeout(timer);remote.destroy();});remote.on('error',()=>socket.destroy());});
 upstream.on('error',()=>socket.destroy());upstream.end();
}catch{socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();}});
setInterval(async()=>{for(const [nonce,exp]of usedTickets)if(exp<Date.now())usedTickets.delete(nonce);for(const s of sessions.values()){if(s.expires<Date.now()){await remove(s);continue;}if(s.status==='booting'){const ready=await docker(['exec',s.name,'adb','-s','emulator-5554','shell','getprop','sys.boot_completed'],5000).catch(()=>null);if(ready==='1')s.status='ready';}}},10000).unref();
async function start(){const old=await docker(['ps','-aq','--filter','label=jojo.android=1']).catch(()=> '');for(const id of old.split(/\s+/).filter(Boolean))await docker(['rm','-f',id]).catch(()=>{});server.listen(Number(process.env.ANDROID_RUNNER_PORT||8788),'127.0.0.1',()=>console.log('Worker Android prêt sur loopback.'));}
process.on('SIGTERM',async()=>{server.close();await Promise.all([...sessions.values()].map(remove));process.exit(0);});
start().catch(()=>{console.error('Worker Android indisponible. Vérifiez Docker.');process.exit(1);});
