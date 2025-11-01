import { App, Plugin } from 'obsidian';
import { OnTaskSettings, DEFAULT_SETTINGS, SettingsChangeEvent, SettingsService } from './SettingsServiceInterface';
import { EventSystem } from '../events';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { Logger } from '../logging/Logger';

export class SettingsServiceImpl extends SettingsAwareSliceService implements SettingsService {
	private app: App;
	private settings: OnTaskSettings;
	private changeListeners: ((event: SettingsChangeEvent) => void)[] = [];
	private eventSystem: EventSystem;
	private logger: Logger;

	constructor(app: App, plugin: Plugin, eventSystem: EventSystem, logger: Logger) {
		super();
		this.app = app;
		this.eventSystem = eventSystem;
		this.logger = logger;
		this.settings = { ...DEFAULT_SETTINGS };
		this.setPlugin(plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		
		const loadedSettings = await this.getPlugin()!.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
		
		await this.migrateFromOldStructure(loadedSettings);
		this.initialized = true;
	}

	private async migrateFromOldStructure(loadedSettings: any): Promise<void> {
		// Migrate from onlyShowToday boolean to dateFilter string
		if (loadedSettings && 'onlyShowToday' in loadedSettings && !('dateFilter' in loadedSettings)) {
			this.settings.dateFilter = loadedSettings.onlyShowToday ? 'today' : 'all';
			// Remove old property
			delete (this.settings as any).onlyShowToday;
			await this.getPlugin()!.saveData(this.settings);
			this.logger.debug('[OnTask Settings] Migrated onlyShowToday to dateFilter');
		}
	}

	getSettings(): OnTaskSettings {
		return { ...this.settings };
	}

	async updateSetting<K extends keyof OnTaskSettings>(key: K, value: OnTaskSettings[K]): Promise<void> {
		const oldValue = this.settings[key];
		this.settings[key] = value;
		
		await this.getPlugin()!.saveData(this.settings);
		this.notifyChange({ key, value, oldValue });
	}

	async updateSettings(updates: Partial<OnTaskSettings>): Promise<void> {
		const changes: SettingsChangeEvent[] = [];
		
		for (const [key, value] of Object.entries(updates)) {
			const typedKey = key as keyof OnTaskSettings;
			const oldValue = this.settings[typedKey];
			(this.settings as any)[typedKey] = value;
			changes.push({ key: typedKey, value, oldValue });
		}
		
		await this.getPlugin()!.saveData(this.settings);
		changes.forEach(change => this.notifyChange(change));
	}

	async resetToDefaults(): Promise<void> {
		const oldSettings = { ...this.settings };
		this.settings = { ...DEFAULT_SETTINGS };
		
		await this.getPlugin()!.saveData(this.settings);
		
		for (const [key, value] of Object.entries(this.settings)) {
			const typedKey = key as keyof OnTaskSettings;
			const oldValue = oldSettings[typedKey];
			this.notifyChange({ key: typedKey, value, oldValue });
		}
	}

	onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void {
		this.changeListeners.push(callback);
		
		return () => {
			const index = this.changeListeners.indexOf(callback);
			if (index > -1) {
				this.changeListeners.splice(index, 1);
			}
		};
	}

	isDailyNotesAvailable(): boolean {
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		const hasDailyNotesPlugin = dailyNotesPlugin !== null;
		
		const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
		const hasDailyNotesCore = dailyNotesCore && dailyNotesCore.enabled;
		
		return hasDailyNotesPlugin || hasDailyNotesCore;
	}

	cleanup(): void {
		this.changeListeners = [];
		this.initialized = false;
	}

	onSettingsChanged(settings: any): void {
		// Hook for custom settings change handling
	}

	private notifyChange(event: SettingsChangeEvent): void {
		this.changeListeners.forEach(callback => {
			try {
				callback(event);
			} catch (error) {
				this.logger.error('[OnTask Settings] Error in settings change listener:', error);
			}
		});

		this.logger.debug('[OnTask Settings] Emitting settings:changed event for', event.key, ':', event.oldValue, '->', event.value);
		this.eventSystem.emit('settings:changed', {
			key: event.key,
			value: event.value,
			oldValue: event.oldValue
		});
	}

}
