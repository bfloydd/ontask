// Settings slice - Service implementation
import { App, Plugin } from 'obsidian';
import { OnTaskSettings, DEFAULT_SETTINGS, SettingsChangeEvent, SettingsService, StatusConfig } from './settings-interface';
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
		
		// Migrate from old statusFilters structure if needed
		await this.migrateFromOldStructure(loadedSettings);
	}

	private async migrateFromOldStructure(loadedSettings: any): Promise<void> {
		// Check if we have old statusFilters structure that needs migration
		if (loadedSettings.statusFilters && !this.settings.statusConfigs.some(config => config.filtered !== undefined)) {
			console.log('OnTask: Migrating from old statusFilters structure');
			
			// Migrate statusFilters to filtered property in statusConfigs
			const statusFilters = loadedSettings.statusFilters;
			this.settings.statusConfigs = this.settings.statusConfigs.map(config => ({
				...config,
				filtered: statusFilters[config.symbol] !== false
			}));
			
			// Save the migrated settings
			await this.plugin.saveData(this.settings);
			console.log('OnTask: Migration completed');
		}
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

	// Status configuration methods
	getStatusConfigs(): StatusConfig[] {
		return [...this.settings.statusConfigs];
	}

	getStatusConfig(symbol: string): StatusConfig | undefined {
		return this.settings.statusConfigs.find(config => config.symbol === symbol);
	}

	getFilteredStatusConfigs(): StatusConfig[] {
		return this.settings.statusConfigs.filter(config => config.filtered !== false);
	}

	getStatusFilters(): Record<string, boolean> {
		const filters: Record<string, boolean> = {};
		this.settings.statusConfigs.forEach(config => {
			filters[config.symbol] = config.filtered !== false;
		});
		return filters;
	}

	async updateStatusFiltered(symbol: string, filtered: boolean): Promise<void> {
		const config = this.getStatusConfig(symbol);
		if (config) {
			await this.updateStatusConfig(symbol, { ...config, filtered });
		}
	}

	async updateStatusConfig(symbol: string, config: StatusConfig): Promise<void> {
		const index = this.settings.statusConfigs.findIndex(c => c.symbol === symbol);
		if (index !== -1) {
			const oldValue = [...this.settings.statusConfigs];
			this.settings.statusConfigs[index] = { ...config };
			
			// Save to plugin data
			await this.plugin.saveData(this.settings);
			
			// Notify listeners
			this.notifyChange({ 
				key: 'statusConfigs', 
				value: [...this.settings.statusConfigs], 
				oldValue 
			});
		}
	}

	async addStatusConfig(config: StatusConfig): Promise<void> {
		const oldValue = [...this.settings.statusConfigs];
		this.settings.statusConfigs.push({ ...config });
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners
		this.notifyChange({ 
			key: 'statusConfigs', 
			value: [...this.settings.statusConfigs], 
			oldValue 
		});
	}

	async removeStatusConfig(symbol: string): Promise<void> {
		const oldValue = [...this.settings.statusConfigs];
		this.settings.statusConfigs = this.settings.statusConfigs.filter(c => c.symbol !== symbol);
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners
		this.notifyChange({ 
			key: 'statusConfigs', 
			value: [...this.settings.statusConfigs], 
			oldValue 
		});
	}

	async reorderStatusConfigs(configs: StatusConfig[]): Promise<void> {
		const oldValue = [...this.settings.statusConfigs];
		this.settings.statusConfigs = [...configs];
		
		// Save to plugin data
		await this.plugin.saveData(this.settings);
		
		// Notify listeners
		this.notifyChange({ 
			key: 'statusConfigs', 
			value: [...this.settings.statusConfigs], 
			oldValue 
		});
	}
}
