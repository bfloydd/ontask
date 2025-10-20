import { App, Plugin } from 'obsidian';
import { LoggingService as ILoggingService, LoggingDependencies } from './logging-interface';
import { Logger, LogLevel } from './Logger';
import { ToggleLoggingCommand } from './ToggleLoggingCommand';
import { Command } from '../../shared/interfaces';
import { centralizedLogger } from '../../shared/centralized-logger';

export class LoggingServiceImpl implements ILoggingService {
    private dependencies: LoggingDependencies;
    private logger: Logger;
    private toggleCommand: ToggleLoggingCommand | null = null;
    private initialized: boolean = false;

    constructor(dependencies: LoggingDependencies) {
        this.dependencies = dependencies;
        this.logger = new Logger('OnTask');
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.logger = new Logger('OnTask');
        
        const settings = this.getSettings();
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.disable();
        }

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: any): void {
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.disable();
        }
    }

    getLogger(): Logger {
        return this.logger;
    }

    createToggleCommand(): Command {
        if (!this.toggleCommand) {
            this.toggleCommand = new ToggleLoggingCommand(
                this.dependencies.app,
                this.logger,
                (enabled: boolean) => {
                    (this.dependencies.plugin as any).settings.debugLoggingEnabled = enabled;
                },
                () => this.dependencies.plugin.saveData((this.dependencies.plugin as any).settings)
            );
        }
        return this.toggleCommand;
    }

    enableDebug(): void {
        centralizedLogger.enable(LogLevel.DEBUG);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = true;
        }
    }

    disableDebug(): void {
        centralizedLogger.enable(LogLevel.INFO);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = false;
        }
    }

    private getSettings(): any {
        return (this.dependencies.plugin as any).settings || {};
    }
}
