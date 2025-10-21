import { LoggingService as ILoggingService, LoggingDependencies } from './LoggingServiceInterface';
import { Command } from '../commands';
import { Logger, LogLevel } from './Logger';
import { ToggleLoggingCommandImpl } from './ToggleLoggingCommandImpl';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { EventSystem } from '../events';

export class LoggingServiceImpl extends SettingsAwareSliceService implements ILoggingService {
    private dependencies: LoggingDependencies;
    private logger: Logger;
    private toggleCommand: ToggleLoggingCommandImpl | null = null;
    private eventSystem?: EventSystem;
    private eventListeners: (() => void)[] = [];

    constructor(dependencies: LoggingDependencies, eventSystem?: EventSystem) {
        super();
        this.dependencies = dependencies;
        this.logger = new Logger('[OnTask] ');
        this.eventSystem = eventSystem;
        this.setPlugin(dependencies.plugin);
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        const settings = this.getSettings();
        if (settings.debugLoggingEnabled) {
            this.logger.on(LogLevel.DEBUG);
        } else {
            this.logger.off();
        }

        // Set up event listeners for settings changes
        this.setupEventListeners();

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.cleanupEventListeners();
        this.initialized = false;
    }

    onSettingsChanged(settings: any): void {
        if (settings.debugLoggingEnabled) {
            this.logger.on(LogLevel.DEBUG);
        } else {
            this.logger.off();
        }
    }

    getLogger(): Logger {
        return this.logger;
    }

    createToggleCommand(): Command {
        if (!this.toggleCommand) {
            this.toggleCommand = new ToggleLoggingCommandImpl(
                this.dependencies.app,
                (enabled: boolean) => {
                    (this.dependencies.plugin as any).settings.debugLoggingEnabled = enabled;
                },
                () => this.dependencies.plugin.saveData((this.dependencies.plugin as any).settings),
                this.logger
            );
        }
        return this.toggleCommand;
    }

    enableDebug(): void {
        this.logger.on(LogLevel.DEBUG);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = true;
        }
    }

    disableDebug(): void {
        this.logger.on(LogLevel.INFO);
        if ((this.dependencies.plugin as any).settings) {
            (this.dependencies.plugin as any).settings.debugLoggingEnabled = false;
        }
    }

    protected getSettings(): any {
        return (this.dependencies.plugin as any).settings || {};
    }

    private setupEventListeners(): void {
        if (!this.eventSystem) return;

        const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
            if (event.data.key === 'debugLoggingEnabled') {
                if (event.data.value) {
                    this.logger.on(LogLevel.DEBUG);
                } else {
                    this.logger.off();
                }
            }
        });
        this.eventListeners.push(() => settingsSubscription.unsubscribe());
    }

    private cleanupEventListeners(): void {
        this.eventListeners.forEach(cleanup => cleanup());
        this.eventListeners = [];
    }
}
