'use strict';
function parseCommand(value){
 if(typeof value!=='string'||!value.trim()||value.length>1000||/[\r\n;&|`$<>\\"']/.test(value))throw Error('Utilisez une commande npm simple, sans shell ni redirection.');
 const words=value.trim().split(/\s+/);if(words.shift()!=='npm')throw Error('Commandes disponibles : npm install, npm install paquet, npm run script, npm test.');
 const action=words.shift();
 if(action==='test'&&!words.length)return {action:'run-script',script:'test',display:'npm test'};
 if(action==='run'&&words.length===1&&/^[A-Za-z0-9:_-]{1,64}$/.test(words[0]))return {action:'run-script',script:words[0],display:'npm run '+words[0]};
 if(action!=='install')throw Error('Commande npm non prise en charge.');
 let dev=false,exact=false;const packages=[];
 for(const word of words){if(word==='--save-dev'||word==='-D')dev=true;else if(word==='--save-exact'||word==='-E')exact=true;else{
  if(!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9][a-z0-9_.-]*(?:@[~^]?[0-9]+(?:\.[0-9x*]+){0,2})?$/i.test(word))throw Error('Utilisez des paquets npm du registre, éventuellement avec une version numérique.');packages.push(word);
 }}
 if(packages.length>12)throw Error('Douze paquets maximum par commande.');
 if(!packages.length&&(dev||exact))throw Error('Indiquez les paquets à ajouter.');
 return {action:packages.length?'install-packages':'install',packages,dev,exact,display:'npm install'+(dev?' --save-dev':'')+(exact?' --save-exact':'')+(packages.length?' '+packages.join(' '):'')};
}
module.exports={parseCommand};
