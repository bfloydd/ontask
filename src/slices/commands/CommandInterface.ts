// Commands slice - Interface definitions

export interface Command {
    execute(): Promise<void>;
}

export interface CommandRegistry {
    registerCommand(command: Command, id: string, name: string): void;
    unregisterCommand(id: string): void;
    getCommand(id: string): Command | undefined;
    getAllCommands(): Map<string, Command>;
}

export interface ObsidianCommand {
    id: string;
    name: string;
    callback: () => void | Promise<void>;
    hotkeys?: Array<{
        modifiers: string[];
        key: string;
    }>;
}
