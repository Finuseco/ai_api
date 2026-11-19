import {createHash} from 'node:crypto';
import type {ProjectFile} from './project-archive';
function digest(file?:ProjectFile){if(!file)return null;return createHash('sha256').update(Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8')).update('\0'+(file.mode||'100644')).digest('hex');}
export function snapshotDigest(files:ProjectFile[]){return createHash('sha256').update(JSON.stringify(files.map(f=>[f.path,digest(f)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))).digest('hex');}
/** Conservative three-way merge. Same-file divergent changes require manual resolution. */
export function mergeGitFiles(base:ProjectFile[],local:ProjectFile[],remote:ProjectFile[]){
 const b=new Map(base.map(f=>[f.path,f])),l=new Map(local.map(f=>[f.path,f])),r=new Map(remote.map(f=>[f.path,f]));
 const files:ProjectFile[]=[],conflicts:string[]=[];
 for(const path of [...new Set([...b.keys(),...l.keys(),...r.keys()])].sort()){
  const original=digest(b.get(path)),ours=digest(l.get(path)),theirs=digest(r.get(path));let chosen;
  if(ours===theirs)chosen=l.get(path);else if(ours===original)chosen=r.get(path);else if(theirs===original)chosen=l.get(path);else{conflicts.push(path);continue;}
  if(chosen)files.push(chosen);
 }
 return {files,conflicts};
}
