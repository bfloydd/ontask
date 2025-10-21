import { App, Plugin } from 'obsidian';
import { LoggingService as ILoggingService, LoggingDependencies } from './LoggingServiceInterface';
import { Logger, LogLevel } from './Logger';
import { ToggleLoggingCommandImpl } from './ToggleLoggingCommandImpl';
import { Command } from '../../shared/interfaces';
import { logger } from '../../shared/Logger';
import { SettingsAwareSliceService } from '../../shared/base-slice';

export class LoggingServiceImpl extends SettingsAwareSliceService implements ILoggingService {
    private dependencies: LoggingDependencies;
    private logger: Logger;
    private toggleCommand: ToggleLoggingCommandImpl | null = null;

    constructor(dependencies: LoggingDependencies) {
        super();
        this.dependencies = dependencies;
        this.logger = new Logger('OnTask');
        this.setPlugin(dependencies.plugin);
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.logger = new Logger('OnTask');
        
        const settings = this.getSettings();
        if (settings.debugLoggingEnabled) {
            logger.enable(LogLevel.DEBUG);
        } else {
            logger.disable();
        }

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: any): void {
        if (settings.debugLoggingEnabled) {
            logger.enable(LogLevel.DEBUG);
        } else {
            logger.disable();
        }
    }

    getLogger(): Logger {
        return this.logger;
    }

    createToggleCommand(): Command {
        if (!this.toggleCommand) {
            this.toggleCommand = new ToggleLoggingCommandImpl(
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
        logger.enable(LogLevel.DEBUG);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = true;
        }
    }

    disableDebug(): void {
        logger.enable(LogLevel.INFO);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = false;
        }
    }

    protected getSettings(): any {
        return (this.dependencies.plugin as any).settings || {};
    }
}
