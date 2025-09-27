// Settings slice - Service implementation
import { App, Plugin } from 'obsidian';
import { OnTaskSettings, DEFAULT_SETTINGS, SettingsChangeEvent, SettingsService } from './settings-interface';
import { EventSystem } from '../events';

export class SettingsServiceImpl implements SettingsService {
	private app: App;
	private plugin: Plugin;
	private settings: OnTaskSettings;
	private changeListeners: ((event: SettingsChangeEvent) => void)[] = [];
	private eventSystem: EventSystem;

	constructor(app: App, plugin: Plugin, eventSystem: EventSystem) {
		this.app = app;
		this.plugin = plugin;
		this.eventSystem = eventSystem;
		this.settings = { ...DEFAULT_SETTINGS };
	}

	async initialize(): Promise<void> {
		// Load settings from plugin data
		const loadedSettings = await this.plugin.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
	}

	getSettings(): OnTaskSettings {
		return { ...this.settings };
	}

	async updateSetting<K extends keyof OnTaskSettings>(key: K, value: OnTaskSettings[K]): Promise<void> {
		const oldValue = this.settings[key];
		this.settings[key] = value;
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners
		this.notifyChange({ key, value, oldValue });
	}

	async updateSettings(updates: Partial<OnTaskSettings>): Promise<void> {
		const changes: SettingsChangeEvent[] = [];
		
		// Track all changes
		for (const [key, value] of Object.entries(updates)) {
			const typedKey = key as keyof OnTaskSettings;
			const oldValue = this.settings[typedKey];
			(this.settings as any)[typedKey] = value;
			changes.push({ key: typedKey, value, oldValue });
		}
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners for all changes
		changes.forEach(change => this.notifyChange(change));
	}

	async resetToDefaults(): Promise<void> {
		const oldSettings = { ...this.settings };
		this.settings = { ...DEFAULT_SETTINGS };
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners for all changes
		for (const [key, value] of Object.entries(this.settings)) {
			const typedKey = key as keyof OnTaskSettings;
			const oldValue = oldSettings[typedKey];
			this.notifyChange({ key: typedKey, value, oldValue });
		}
	}

	onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void {
		this.changeListeners.push(callback);
		
		// Return unsubscribe function
		return () => {
			const index = this.changeListeners.indexOf(callback);
			if (index > -1) {
				this.changeListeners.splice(index, 1);
			}
		};
	}

	isDailyNotesAvailable(): boolean {
		// Check if Daily Notes plugin is available or if Daily Notes is a core feature
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		const hasDailyNotesPlugin = dailyNotesPlugin !== null;
		
		// Check if Daily Notes core feature is enabled
		const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
		const hasDailyNotesCore = dailyNotesCore && dailyNotesCore.enabled;
		
		return hasDailyNotesPlugin || hasDailyNotesCore;
	}

	private notifyChange(event: SettingsChangeEvent): void {
		// Notify direct listeners
		this.changeListeners.forEach(callback => {
			try {
				callback(event);
			} catch (error) {
				console.error('Error in settings change listener:', error);
			}
		});

		// Emit event system event
		this.eventSystem.emit('settings:changed', {
			key: event.key,
			value: event.value,
			oldValue: event.oldValue
		});
	}
}
