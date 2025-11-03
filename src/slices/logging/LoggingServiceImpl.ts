import { LoggingService as ILoggingService, LoggingDependencies } from './LoggingServiceInterface';
import { Command } from '../commands';
import { Logger, LogLevel } from './Logger';
import { ToggleLoggingCommandImpl } from './ToggleLoggingCommandImpl';
import { SettingsAwareSliceService } from '../../shared/BaseSlice';
import { EventSystem, EventData } from '../events';
import { OnTaskSettings, SettingsChangeEvent } from '../settings/SettingsServiceInterface';
import { Plugin } from 'obsidian';

/**
 * Interface for plugin with settings property
 * This provides type safety when accessing plugin settings
 */
interface PluginWithSettings extends Plugin {
	settings: OnTaskSettings;
}

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

        this.setupEventListeners();

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.cleanupEventListeners();
        this.initialized = false;
    }

    onSettingsChanged(settings: OnTaskSettings): void {
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
            const pluginWithSettings = this.dependencies.plugin as PluginWithSettings;
            this.toggleCommand = new ToggleLoggingCommandImpl(
                this.dependencies.app,
                (enabled: boolean) => {
                    pluginWithSettings.settings.debugLoggingEnabled = enabled;
                },
                () => this.dependencies.plugin.saveData(pluginWithSettings.settings),
                this.logger
            );
        }
        return this.toggleCommand;
    }

    enableDebug(): void {
        this.logger.on(LogLevel.DEBUG);
        const pluginWithSettings = this.dependencies.plugin as PluginWithSettings;
        if (pluginWithSettings.settings) {
            pluginWithSettings.settings.debugLoggingEnabled = true;
        }
    }

    disableDebug(): void {
        this.logger.on(LogLevel.INFO);
        const pluginWithSettings = this.dependencies.plugin as PluginWithSettings;
        if (pluginWithSettings.settings) {
            pluginWithSettings.settings.debugLoggingEnabled = false;
        }
    }

    setEventSystem(eventSystem: EventSystem): void {
        this.eventSystem = eventSystem;
        this.setupEventListeners();
    }

    protected getSettings<T extends OnTaskSettings = OnTaskSettings>(): T {
        const pluginWithSettings = this.dependencies.plugin as PluginWithSettings;
        return (pluginWithSettings.settings || {} as OnTaskSettings) as T;
    }

    private setupEventListeners(): void {
        if (!this.eventSystem) return;

        const settingsSubscription = this.eventSystem.on<EventData<SettingsChangeEvent>>('settings:changed', (event) => {
            if (event.data?.key === 'debugLoggingEnabled') {
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
