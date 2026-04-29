import { ICommand } from '../types.js';
export declare class CommandRegistry {
    prefix: string;
    commands: Map<string, ICommand>;
    constructor(prefix?: string);
    register(command: ICommand): void;
    loadCommands(dirPath: string, wrapper?: (mod: any) => ICommand, recursive?: boolean): Promise<void>;
    findCommand(text: string): {
        command: ICommand;
        args: string[];
    } | null;
}
