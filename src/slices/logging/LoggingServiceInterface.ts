import { App, Plugin } from 'obsidian';
import { Logger, LogLevel } from './Logger';
import { Command } from '../commands';

export interface LoggingService {
    initialize(): Promise<void>;
    cleanup(): void;
    onSettingsChanged(settings: any): void;
    getLogger(): Logger;
    createToggleCommand(): Command;
    enableDebug(): void;
    disableDebug(): void;
}

export interface LoggingDependencies {
    app: App;
    plugin: Plugin;
}
