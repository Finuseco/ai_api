export interface TerminalCommand {action:'install'|'install-packages'|'run-script';script?:string;packages?:string[];dev?:boolean;exact?:boolean;display:string}
export function parseCommand(value:string):TerminalCommand;
