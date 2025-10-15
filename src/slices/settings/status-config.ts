// Status configuration with hex colors
import { StatusConfig } from './settings-interface';
import { DataService } from '../data/data-service-interface';

// Re-export the interface for backward compatibility
export type { StatusConfig };

// Service class to handle status configuration
export class StatusConfigService {
	private dataService: DataService;

	constructor(dataService: DataService) {
		this.dataService = dataService;
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
