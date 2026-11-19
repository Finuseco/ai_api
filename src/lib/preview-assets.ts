import {excludedPath} from './project-files';
export interface PreviewFile {path:string;content:string;encoding:string}
export function resolvePreviewAsset(base:string,value:string):string|null {
 let clean;try{clean=decodeURIComponent(value.split(/[?#]/)[0]);}catch{return null;}
 if(!clean||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(clean)||clean.includes('\\'))return null;
 const parts=clean.startsWith('/')?[]:base.split('/').slice(0,-1);
 for(const part of clean.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
 return parts.join('/')||null;
}
export function previewFiles(rows:PreviewFile[],member:boolean){
 const safe=rows.filter(f=>!excludedPath(f.path)&&/\.(html|css|js|json|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|mp3|wav|ogg|m4a|mp4|webm)$/i.test(f.path));
 if(member)return safe;
 const map=new Map(safe.map(f=>[f.path,f])),selected=new Map<string,PreviewFile>();
 const queue=[map.get('index.html')||map.get('public/index.html')].filter(Boolean) as PreviewFile[];
 while(queue.length){const file=queue.shift()!;if(selected.has(file.path))continue;selected.set(file.path,file);
  if(file.encoding!=='utf8'||! /\.(html|css|js)$/.test(file.path))continue;
  const refs=[...file.content.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)'"\s]+)|(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)];
  for(const ref of refs){const path=resolvePreviewAsset(file.path,ref[1]||ref[2]||ref[3]),target=path&&(map.get(path)||map.get('public/'+path));if(target&&!selected.has(target.path))queue.push(target);}
 }
 return [...selected.values()];
}
