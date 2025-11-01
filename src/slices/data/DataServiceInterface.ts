// Data service interface for handling data.json operations

export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string; // Hex color
	backgroundColor?: string; // Optional background color
	filtered?: boolean; // Whether this status is filtered (shown)
}

export interface QuickFilter {
	id: string;
	name: string;
	statusSymbols: string[]; // Array of status symbols to check
	enabled: boolean; // Whether this quick filter is enabled (shows in popup)
}

export interface DataServiceData {
	statusConfigs?: StatusConfig[];
	quickFilters?: QuickFilter[];
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
	
	// Quick filter methods
	getQuickFilters(): QuickFilter[];
	getQuickFilter(id: string): QuickFilter | undefined;
	addQuickFilter(filter: QuickFilter): Promise<void>;
	updateQuickFilter(id: string, filter: QuickFilter): Promise<void>;
	removeQuickFilter(id: string): Promise<void>;
	reorderQuickFilters(filters: QuickFilter[]): Promise<void>;
	
	// Data persistence
	saveData(): Promise<void>;
	loadData(): Promise<DataServiceData>;
}
