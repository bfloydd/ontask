import { Plugin } from 'obsidian';
import { OnTaskSettings } from '../slices/settings/SettingsServiceInterface';

export abstract class PluginAwareSliceService {
    protected plugin: Plugin | null = null;
    protected initialized: boolean = false;

    setPlugin(plugin: Plugin): void {
        this.plugin = plugin;
    }

    getPlugin(): Plugin | null {
        return this.plugin;
    }

    abstract initialize(): Promise<void>;
    abstract cleanup(): void;
}

export abstract class SettingsAwareSliceService extends PluginAwareSliceService {
    protected getSettings<T extends OnTaskSettings = OnTaskSettings>(): T {
        if (!this.plugin) {
            throw new Error('Plugin not set');
        }
        return ((this.plugin as Plugin & { settings?: T }).settings || {}) as T;
    }

    onSettingsChanged(settings: OnTaskSettings): void {
    }
}



