// Status configuration with hex colors
import { StatusConfig } from './settings-interface';
import { SettingsService } from './settings-interface';

// Re-export the interface for backward compatibility
export type { StatusConfig };

// Service class to handle status configuration
export class StatusConfigService {
	private settingsService: SettingsService;

	constructor(settingsService: SettingsService) {
		this.settingsService = settingsService;
	}

	getStatusConfigs(): StatusConfig[] {
		return this.settingsService.getSettings().statusConfigs;
	}

	getStatusConfig(symbol: string): StatusConfig | undefined {
		const configs = this.getStatusConfigs();
		return configs.find(config => config.symbol === symbol);
	}

	getStatusColor(symbol: string): string {
		const config = this.getStatusConfig(symbol);
		return config?.color || '#6b7280'; // Default gray color
	}

	getStatusBackgroundColor(symbol: string): string {
		const config = this.getStatusConfig(symbol);
		return config?.backgroundColor || 'transparent';
	}
}
