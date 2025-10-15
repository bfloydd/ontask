// Data service implementation for handling data.json operations

import { App, Plugin } from 'obsidian';
import { DataService, StatusConfig } from './data-service-interface';
import { DEFAULT_STATUS_CONFIGS } from '../settings/settings-interface';

export class DataServiceImpl implements DataService {
	private app: App;
	private plugin: Plugin;
	private data: any = {};

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	async initialize(): Promise<void> {
		// Load data from data.json
		this.data = await this.loadData();
		
		// Initialize statusConfigs with defaults if not present
		if (!this.data.statusConfigs || this.data.statusConfigs.length === 0) {
			this.data.statusConfigs = [...DEFAULT_STATUS_CONFIGS];
			await this.saveData();
		}
	}

	async loadData(): Promise<any> {
		try {
			return await this.plugin.loadData() || {};
		} catch (error) {
			console.error('OnTask: Error loading data:', error);
			return {};
		}
	}

	async saveData(): Promise<void> {
		try {
			await this.plugin.saveData(this.data);
		} catch (error) {
			console.error('OnTask: Error saving data:', error);
		}
	}

	// Status configuration methods
	getStatusConfigs(): StatusConfig[] {
		return [...(this.data.statusConfigs || [])];
	}

	getStatusConfig(symbol: string): StatusConfig | undefined {
		return this.data.statusConfigs?.find((config: StatusConfig) => config.symbol === symbol);
	}

	getFilteredStatusConfigs(): StatusConfig[] {
		return this.data.statusConfigs?.filter((config: StatusConfig) => config.filtered !== false) || [];
	}

	getStatusFilters(): Record<string, boolean> {
		const filters: Record<string, boolean> = {};
		this.data.statusConfigs?.forEach((config: StatusConfig) => {
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
		const index = this.data.statusConfigs.findIndex((c: StatusConfig) => c.symbol === symbol);
		if (index !== -1) {
			this.data.statusConfigs[index] = { ...config };
			await this.saveData();
		}
	}

	async addStatusConfig(config: StatusConfig): Promise<void> {
		this.data.statusConfigs.push({ ...config });
		await this.saveData();
	}

	async removeStatusConfig(symbol: string): Promise<void> {
		this.data.statusConfigs = this.data.statusConfigs.filter((c: StatusConfig) => c.symbol !== symbol);
		await this.saveData();
	}

	async reorderStatusConfigs(configs: StatusConfig[]): Promise<void> {
		this.data.statusConfigs = [...configs];
		await this.saveData();
	}
}
