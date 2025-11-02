import { Plugin } from 'obsidian';
import { StatusConfig, DEFAULT_STATUS_CONFIGS } from './SettingsServiceInterface';
import { DataService } from '../data/DataServiceInterface';
import { PluginAwareSliceService } from '../../shared/BaseSlice';

// Re-export the interface for backward compatibility
export type { StatusConfig };

// Service class to handle status configuration
export class StatusConfigService extends PluginAwareSliceService {
	/**
	 * Built-in status symbols that are defined by default in the plugin.
	 * These symbols are derived from DEFAULT_STATUS_CONFIGS to ensure consistency.
	 */
	static readonly BUILT_IN_STATUS_SYMBOLS: readonly string[] = DEFAULT_STATUS_CONFIGS.map(config => config.symbol);

	/**
	 * Check if a status symbol is a built-in (default) status.
	 * @param symbol - The status symbol to check
	 * @returns true if the symbol is a built-in status, false otherwise
	 */
	static isBuiltInStatus(symbol: string): boolean {
		return StatusConfigService.BUILT_IN_STATUS_SYMBOLS.includes(symbol);
	}
	private dataService: DataService;

	constructor(dataService: DataService, plugin: Plugin) {
		super();
		this.dataService = dataService;
		this.setPlugin(plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
	}

	cleanup(): void {
		this.initialized = false;
	}

	getStatusConfigs(): StatusConfig[] {
		return this.dataService.getStatusConfigs();
	}

	getStatusConfig(symbol: string): StatusConfig | undefined {
		return this.dataService.getStatusConfig(symbol);
	}

	getStatusColor(symbol: string): string {
		const config = this.getStatusConfig(symbol);
		return config?.color || '#6b7280'; // Default gray color
	}

	getStatusBackgroundColor(symbol: string): string {
		const config = this.getStatusConfig(symbol);
		return config?.backgroundColor || 'transparent';
	}

	getFilteredStatusConfigs(): StatusConfig[] {
		return this.dataService.getFilteredStatusConfigs();
	}

	getStatusFilters(): Record<string, boolean> {
		return this.dataService.getStatusFilters();
	}

	async updateStatusFiltered(symbol: string, filtered: boolean): Promise<void> {
		return this.dataService.updateStatusFiltered(symbol, filtered);
	}

	async updateStatusConfig(symbol: string, config: StatusConfig): Promise<void> {
		return this.dataService.updateStatusConfig(symbol, config);
	}

	async addStatusConfig(config: StatusConfig): Promise<void> {
		return this.dataService.addStatusConfig(config);
	}

	async removeStatusConfig(symbol: string): Promise<void> {
		return this.dataService.removeStatusConfig(symbol);
	}

	async reorderStatusConfigs(configs: StatusConfig[]): Promise<void> {
		return this.dataService.reorderStatusConfigs(configs);
	}
}




