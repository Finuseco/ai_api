export const FILE_LIMIT=5*1024*1024, TOTAL_LIMIT=30*1024*1024, COUNT_LIMIT=1500;
export function projectPath(value:string):string {
  if(typeof value!=='string'||!value||value.length>240||value.startsWith('/')||(value.includes('\\')||value.includes(':'))||/[\x00-\x1f]/.test(value))throw new Error('Chemin de fichier invalide.');
  const parts=value.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||['__proto__','prototype','constructor'].includes(p)))throw new Error('Chemin de fichier invalide.');
  return value;
}
export function excludedPath(value:string):boolean {
  return value.split('/').some(p=>['.git','node_modules','.next','.ssh','backups'].includes(p)||(/^\.env(?:\.|$)/.test(p)&&!/^\.env\.(example|sample|template)$/.test(p))||/\.(pem|key|p12|pfx|jks)$/i.test(p));
}
export function editablePath(value:string):string {
  const p=projectPath(value);if(excludedPath(p))throw new Error('Ce fichier sensible ou généré est exclu du projet.');return p;
}
