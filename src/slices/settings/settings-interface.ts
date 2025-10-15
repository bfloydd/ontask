// Settings slice - Interface definitions

export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string; // Hex color
	backgroundColor?: string; // Optional background color
	filtered?: boolean; // Whether this status is filtered (shown)
}

export interface OnTaskSettings {
	onlyShowToday: boolean;
	topTaskColor: string;
	showTopTaskInStatusBar: boolean;
	showTopTaskInEditor: boolean;
	checkboxSource: 'streams' | 'daily-notes' | 'folder';
	customFolderPath: string;
	includeSubfolders: boolean;
	loadMoreLimit: number;
	hideCompletedTasks: boolean;
}

export const DEFAULT_SETTINGS: OnTaskSettings = {
	onlyShowToday: false,
	topTaskColor: 'neutral',
	showTopTaskInStatusBar: true,
	showTopTaskInEditor: true,
	checkboxSource: 'streams',
	customFolderPath: '',
	includeSubfolders: true,
	loadMoreLimit: 10,
	hideCompletedTasks: false
};

// Default status configurations - used only for initialization
export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
	{ symbol: '.', name: 'To-do', description: 'Not started', color: '#6b7280', backgroundColor: 'transparent', filtered: true },
	{ symbol: '+', name: 'Next', description: 'Next up, on deck', color: '#fff', backgroundColor: 'brown', filtered: true },
	{ symbol: '/', name: 'In Progress', description: 'Incomplete', color: '#ffffff', backgroundColor: '#dc2626', filtered: true },
	{ symbol: 'x', name: 'Done', description: 'Completed', color: '#ffffff', backgroundColor: '#10b981', filtered: true },
	{ symbol: '!', name: 'Important', description: 'Top task', color: '#ffffff', backgroundColor: '#ef4444', filtered: true },
	{ symbol: '*', name: 'Star', description: 'Marked', color: '#ffffff', backgroundColor: '#8b5cf6', filtered: true },
	{ symbol: '?', name: 'Question', description: 'Needs clarification', color: '#ffffff', backgroundColor: '#f59e0b', filtered: true },
	{ symbol: 'r', name: 'Review', description: 'In review', color: '#ffffff', backgroundColor: '#6b7280', filtered: true },
	{ symbol: 'b', name: 'Blocked', description: 'Can\'t continue', color: '#ffffff', backgroundColor: '#dc2626', filtered: true },
	{ symbol: '<', name: 'Scheduled', description: 'On the calendar', color: '#ffffff', backgroundColor: '#059669', filtered: true },
	{ symbol: '>', name: 'Forward', description: 'Another day', color: '#ffffff', backgroundColor: '#7c3aed', filtered: true },
	{ symbol: '#', name: 'Backburner', description: 'Indefinitely delayed', color: '#ffffff', backgroundColor: '#7c3aed', filtered: true },
	{ symbol: '-', name: 'Cancelled', description: 'Not doing', color: '#ffffff', backgroundColor: '#9ca3af', filtered: true }
];

export interface SettingsChangeEvent {
	key: keyof OnTaskSettings;
	value: any;
	oldValue: any;
}

export interface SettingsService {
	// Initialize settings service
	initialize(): Promise<void>;
	
	// Get current settings
	getSettings(): OnTaskSettings;
	
	// Update a single setting
	updateSetting<K extends keyof OnTaskSettings>(key: K, value: OnTaskSettings[K]): Promise<void>;
	
	// Update multiple settings
	updateSettings(updates: Partial<OnTaskSettings>): Promise<void>;
	
	// Reset to defaults
	resetToDefaults(): Promise<void>;
	
	// Subscribe to settings changes
	onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void;
	
	// Check if Daily Notes is available
	isDailyNotesAvailable(): boolean;
}
