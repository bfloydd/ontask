import { App, Notice } from 'obsidian';
import { Command } from '../commands';
import { Logger, LogLevel } from './Logger';

export class ToggleLoggingCommandImpl implements Command {
    private logger: Logger;

    constructor(
        private app: App,
        private updateSetting: (enabled: boolean) => void,
        private saveSettings: () => Promise<void>,
        logger: Logger
    ) {
        this.logger = logger;
    }

    async execute(): Promise<void> {
        // Toggle between DEBUG and INFO
        if (this.logger.isEnabled()) {
            this.logger.on(LogLevel.INFO);
            this.updateSetting(false);
            new Notice('Streams logging set to INFO level');
        } else {
            this.logger.on(LogLevel.DEBUG);
            this.updateSetting(true);
            new Notice('Streams logging enabled (DEBUG level)');
        }
        
        // Save settings
        await this.saveSettings();
    }
}