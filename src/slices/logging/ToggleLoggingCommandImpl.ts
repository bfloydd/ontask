import { App, Notice } from 'obsidian';
import { Command } from '../../shared/interfaces';
import { Logger, LogLevel } from './Logger';
import { logger } from '../../shared/Logger';

export class ToggleLoggingCommandImpl implements Command {
    constructor(
        private app: App,
        private logger: Logger,
        private updateSetting: (enabled: boolean) => void,
        private saveSettings: () => Promise<void>
    ) {}

    async execute(): Promise<void> {
        // Toggle between DEBUG and INFO
        if (logger.isEnabled()) {
            logger.enable(LogLevel.INFO);
            this.updateSetting(false);
            new Notice('Streams logging set to INFO level');
        } else {
            logger.enable(LogLevel.DEBUG);
            this.updateSetting(true);
            new Notice('Streams logging enabled (DEBUG level)');
        }
        
        // Save settings
        await this.saveSettings();
    }
}