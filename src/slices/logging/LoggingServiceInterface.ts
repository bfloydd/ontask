import { App, Plugin } from 'obsidian';
import { Logger } from './Logger';
import { Command } from '../commands';
import { EventSystem } from '../events';

export interface LoggingService {
    initialize(): Promise<void>;
    cleanup(): void;
    onSettingsChanged(settings: any): void;
    getLogger(): Logger;
    createToggleCommand(): Command;
    enableDebug(): void;
    disableDebug(): void;
    setEventSystem(eventSystem: EventSystem): void;
}

export interface LoggingDependencies {
    app: App;
    plugin: Plugin;
}
