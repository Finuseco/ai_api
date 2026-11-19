export type AiProvider='codex';
export function aiProviders(){return [{id:'codex' as const,label:'OpenAI · Codage',configured:Boolean(process.env.OPENAI_API_KEY&&process.env.OPENAI_CODEX_MODEL),model:process.env.OPENAI_CODEX_MODEL||null}];}
export function selectProvider(value?:string):AiProvider {
 if(value&&value!=='codex')throw Error('Seule l’API OpenAI est prise en charge.');
 return 'codex';
}
