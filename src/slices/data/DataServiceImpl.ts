// Data service implementation for handling data.json operations

import { App, Plugin } from 'obsidian';
import { DataService, StatusConfig, QuickFilter } from './DataServiceInterface';
import { DEFAULT_STATUS_CONFIGS } from '../settings/SettingsServiceInterface';
import { PluginAwareSliceService } from '../../shared/base-slice';

export class DataServiceImpl extends PluginAwareSliceService implements DataService {
	private app: App;
	private data: any = {};

	constructor(app: App, plugin: Plugin) {
		super();
		this.app = app;
		this.setPlugin(plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		
		// Load data from data.json
		this.data = await this.loadData();
		
		// Initialize statusConfigs with defaults if not present
		if (!this.data.statusConfigs || this.data.statusConfigs.length === 0) {
			this.data.statusConfigs = [...DEFAULT_STATUS_CONFIGS];
			await this.saveData();
		}
		
		// Initialize quickFilters with defaults if not present
		if (!this.data.quickFilters || this.data.quickFilters.length === 0) {
			this.data.quickFilters = [
				{
					id: 'review',
					name: 'Review',
					statusSymbols: ['r'],
					enabled: true
				},
				{
					id: 'lagging',
					name: 'Lagging',
					statusSymbols: ['.', '>', 'r', 'b', '?'],
					enabled: true
				}
		];
		await this.saveData();
	}
	
	this.initialized = true;
}

cleanup(): void {
	this.data = {};
	this.initialized = false;
}

	async loadData(): Promise<any> {
		try {
			return await this.getPlugin()!.loadData() || {};
		} catch (error) {
			console.error('OnTask: Error loading data:', error);
			return {};
		}
	}

	async saveData(): Promise<void> {
		try {
			await this.getPlugin()!.saveData(this.data);
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

	// Quick filter methods
	getQuickFilters(): QuickFilter[] {
		return [...(this.data.quickFilters || [])];
	}

	getQuickFilter(id: string): QuickFilter | undefined {
		return this.data.quickFilters?.find((filter: QuickFilter) => filter.id === id);
	}

	async addQuickFilter(filter: QuickFilter): Promise<void> {
		if (!this.data.quickFilters) {
			this.data.quickFilters = [];
		}
		this.data.quickFilters.push({ ...filter });
		await this.saveData();
	}

	async updateQuickFilter(id: string, filter: QuickFilter): Promise<void> {
		const index = this.data.quickFilters.findIndex((f: QuickFilter) => f.id === id);
		if (index !== -1) {
			this.data.quickFilters[index] = { ...filter };
			await this.saveData();
		}
	}

	async removeQuickFilter(id: string): Promise<void> {
		this.data.quickFilters = this.data.quickFilters.filter((f: QuickFilter) => f.id !== id);
		await this.saveData();
	}
}
