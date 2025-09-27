// Settings slice - Interface definitions

export interface OnTaskSettings {
	hideCompletedTasks: boolean;
	onlyShowToday: boolean;
	topTaskColor: string;
	showTopTaskInStatusBar: boolean;
	checkboxSource: 'streams' | 'daily-notes' | 'folder';
	customFolderPath: string;
	includeSubfolders: boolean;
}

export const DEFAULT_SETTINGS: OnTaskSettings = {
	hideCompletedTasks: false,
	onlyShowToday: false,
	topTaskColor: 'neutral',
	showTopTaskInStatusBar: true,
	checkboxSource: 'streams',
	customFolderPath: '',
	includeSubfolders: true
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
