// Data service interface for handling data.json operations

export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string; // Hex color
	backgroundColor?: string; // Optional background color
	filtered?: boolean; // Whether this status is filtered (shown)
}

export interface DataService {
	// Initialize data service
	initialize(): Promise<void>;
	
	// Status configuration methods
	getStatusConfigs(): StatusConfig[];
	getStatusConfig(symbol: string): StatusConfig | undefined;
	getFilteredStatusConfigs(): StatusConfig[];
	getStatusFilters(): Record<string, boolean>;
	updateStatusFiltered(symbol: string, filtered: boolean): Promise<void>;
	updateStatusConfig(symbol: string, config: StatusConfig): Promise<void>;
	addStatusConfig(config: StatusConfig): Promise<void>;
	removeStatusConfig(symbol: string): Promise<void>;
	reorderStatusConfigs(configs: StatusConfig[]): Promise<void>;
	
	// Data persistence
	saveData(): Promise<void>;
	loadData(): Promise<any>;
}
