// Settings slice - Interface definitions

export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string; // Hex color
	backgroundColor?: string; // Optional background color
}

export interface OnTaskSettings {
	hideCompletedTasks: boolean;
	onlyShowToday: boolean;
	topTaskColor: string;
	showTopTaskInStatusBar: boolean;
	showTopTaskInEditor: boolean;
	checkboxSource: 'streams' | 'daily-notes' | 'folder';
	customFolderPath: string;
	includeSubfolders: boolean;
	statusConfigs: StatusConfig[];
}

export const DEFAULT_SETTINGS: OnTaskSettings = {
	hideCompletedTasks: false,
	onlyShowToday: false,
	topTaskColor: 'neutral',
	showTopTaskInStatusBar: true,
	showTopTaskInEditor: false,
	checkboxSource: 'streams',
	customFolderPath: '',
	includeSubfolders: true,
	statusConfigs: [
		{ symbol: ' ', name: 'To-do', description: 'Not started', color: '#6b7280', backgroundColor: 'transparent' },
		{ symbol: 'x', name: 'Done', description: 'Completed', color: '#ffffff', backgroundColor: '#10b981' },
		{ symbol: '/', name: 'In Progress', description: 'Incomplete', color: '#ffffff', backgroundColor: '#dc2626' },
		{ symbol: '!', name: 'Important', description: 'Top task', color: '#ffffff', backgroundColor: '#ef4444' },
		{ symbol: '?', name: 'Question', description: 'Needs clarification', color: '#ffffff', backgroundColor: '#f59e0b' },
		{ symbol: '*', name: 'Star', description: 'Marked', color: '#ffffff', backgroundColor: '#8b5cf6' },
		{ symbol: 'r', name: 'Review', description: 'In review', color: '#ffffff', backgroundColor: '#6b7280' },
		{ symbol: 'b', name: 'Blocked', description: 'Can\'t start', color: '#ffffff', backgroundColor: '#dc2626' },
		{ symbol: '<', name: 'Scheduled', description: 'On the calendar', color: '#ffffff', backgroundColor: '#059669' },
		{ symbol: '>', name: 'Forward', description: 'Another day', color: '#ffffff', backgroundColor: '#7c3aed' },
		{ symbol: '-', name: 'Cancelled', description: 'Not doing', color: '#ffffff', backgroundColor: '#9ca3af' }
	]
};

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
