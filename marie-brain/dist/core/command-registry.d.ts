import { ICommand } from '../types.js';
export declare class CommandRegistry {
    commands: Map<string, ICommand>;
    private prefixes;
    constructor(prefix?: string | string[]);
    register(command: ICommand): void;
    loadCommands(dirPath: string, wrapper?: (mod: any) => ICommand, recursive?: boolean): Promise<void>;
    findCommand(text: string): {
        command: ICommand;
        args: string[];
    } | null;
}
