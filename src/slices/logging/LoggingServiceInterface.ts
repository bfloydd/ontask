import { App, Plugin } from 'obsidian';
import { Logger } from './Logger';
import { Command } from '../commands';
import { EventSystem } from '../events';
import { OnTaskSettings } from '../settings/SettingsServiceInterface';

export interface LoggingService {
    initialize(): Promise<void>;
    cleanup(): void;
    onSettingsChanged(settings: OnTaskSettings): void;
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
