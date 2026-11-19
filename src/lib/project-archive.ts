import * as yauzl from 'yauzl';
import JSZip from 'jszip';
import {COUNT_LIMIT,FILE_LIMIT,TOTAL_LIMIT,excludedPath,projectPath} from './project-files';
export interface ProjectFile {path:string; content:string; encoding:'utf8'|'base64';mode?:'100644'|'100755'}
export async function readArchive(buffer:Buffer,stripRoot=false):Promise<{files:ProjectFile[];skipped:number}> {
 if(buffer.length>20*1024*1024)throw new Error('ZIP limité à 20 Mo.');
 const raw:ProjectFile[]=[];let skipped=0,total=0,count=0;
 await new Promise<void>((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
  if(error||!zip)return reject(new Error('Archive ZIP invalide.'));
  let failed=false;
  const fail=(e:Error)=>{if(!failed){failed=true;zip.close();reject(e);}};
  zip.on('error',()=>fail(new Error('Archive ZIP endommagée.')));zip.on('end',()=>{if(!failed)resolve();});
  zip.on('entry',(entry:yauzl.Entry)=>{
   try {
    if(++count>COUNT_LIMIT)throw new Error('Archive limitée à 1 500 entrées.');
    const path=projectPath(entry.fileName.replace(/\/$/,''));
    const unixMode=(entry.externalFileAttributes>>>16)&0xffff;
    if((unixMode&0xf000)===0xa000)throw new Error('Les liens symboliques sont interdits.');
    if(entry.fileName.endsWith('/')){zip.readEntry();return;}
    if(excludedPath(path)){skipped++;zip.readEntry();return;}
    if(entry.uncompressedSize>FILE_LIMIT||total+entry.uncompressedSize>TOTAL_LIMIT)throw new Error('Projet trop volumineux (30 Mo, 5 Mo par fichier).');
    zip.openReadStream(entry,(err,stream)=>{
     if(err||!stream)return fail(new Error('Impossible de lire l’archive.'));
     const chunks:Buffer[]=[];let size=0;
     stream.on('data',(chunk:Buffer)=>{size+=chunk.length;total+=chunk.length;if(size>FILE_LIMIT||total>TOTAL_LIMIT){stream.destroy();fail(new Error('Taille décompressée dépassée.'));}else chunks.push(chunk);});
     stream.on('error',()=>fail(new Error('Taille ou contenu ZIP invalide.')));
     stream.on('end',()=>{if(failed)return;const bytes=Buffer.concat(chunks);let content='',encoding:'utf8'|'base64'='utf8';try{if(bytes.includes(0))throw Error();content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{encoding='base64';content=bytes.toString('base64');}raw.push({path,content,encoding,mode:(unixMode&0o111)?'100755':'100644'});zip.readEntry();});
    });
   } catch(e){fail(e as Error);}
  });zip.readEntry();
 }));
 if(!raw.length)throw new Error('Aucun fichier exploitable dans cette archive.');
 const root=raw[0].path.split('/')[0];
 const files=stripRoot&&raw.every(f=>f.path.startsWith(root+'/')) ? raw.map(f=>({...f,path:projectPath(f.path.slice(root.length+1))})) : raw;
 const unique=new Set<string>();for(const file of files){if(excludedPath(file.path))throw new Error('Fichier exclu après normalisation.');if(unique.has(file.path))throw new Error('Chemins dupliqués dans l’archive.');unique.add(file.path);}
 return {files,skipped};
}
export async function projectZip(files:ProjectFile[]) {
 const zip=new JSZip();let total=0;
 if(files.length>COUNT_LIMIT)throw Error('Trop de fichiers.');
 for(const file of files){const path=projectPath(file.path);if(excludedPath(path))continue;const bytes=Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');total+=bytes.length;if(bytes.length>FILE_LIMIT||total>TOTAL_LIMIT)throw Error('Export trop volumineux.');zip.file(path,bytes,{unixPermissions:parseInt(file.mode||'100644',8)});}
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',platform:'UNIX'});
}
