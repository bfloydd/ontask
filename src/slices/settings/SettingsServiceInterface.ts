export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string;
	backgroundColor?: string;
	filtered?: boolean;
	topTaskRanking?: number;
}

export interface OnTaskSettings {
	dateFilter: 'all' | 'today';
	topTaskColor: string;
	useThemeDefaultColor: boolean;
	showTopTaskInEditor: boolean;
	checkboxSource: 'streams' | 'daily-notes' | 'folder';
	customFolderPath: string;
	includeSubfolders: boolean;
	loadMoreLimit: number;
	hideCompletedTasks: boolean;
	debugLoggingEnabled: boolean;
}

export const DEFAULT_SETTINGS: OnTaskSettings = {
	dateFilter: 'all',
	topTaskColor: '#ff6b6b',
	useThemeDefaultColor: true,
	showTopTaskInEditor: true,
	checkboxSource: 'daily-notes',
	customFolderPath: '',
	includeSubfolders: true,
	loadMoreLimit: 10,
	hideCompletedTasks: false,
	debugLoggingEnabled: false
};

export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
	{ symbol: '.', name: 'To-do', description: 'Not started', color: '#6b7280', backgroundColor: 'transparent', filtered: true },
	{ symbol: '/', name: 'In progress', description: 'Incomplete', color: '#ffffff', backgroundColor: '#dc2626', filtered: true, topTaskRanking: 1 },
	{ symbol: '+', name: 'Next', description: 'On Deck', color: '#ffffff', backgroundColor: 'darkred', filtered: true, topTaskRanking: 2 },
	{ symbol: '!', name: 'Important', description: 'Upcoming', color: '#ffffff', backgroundColor: '#ef4444', filtered: true, topTaskRanking: 3 },
	{ symbol: 'x', name: 'Done', description: 'Completed', color: '#ffffff', backgroundColor: '#10b981', filtered: false },
	{ symbol: '*', name: 'Star', description: 'Special', color: '#ffffff', backgroundColor: '#8b5cf6', filtered: true, topTaskRanking: 4 },
	{ symbol: '?', name: 'Question', description: 'Needs clarification', color: '#ffffff', backgroundColor: '#f59e0b', filtered: true },
	{ symbol: 'r', name: 'Review', description: 'Needs review', color: '#ffffff', backgroundColor: '#6b7280', filtered: true },
	{ symbol: 'b', name: 'Blocked', description: 'Can\'t continue', color: '#ffffff', backgroundColor: '#dc2626', filtered: false },
	{ symbol: '>', name: 'Forward', description: 'Another day', color: '#ffffff', backgroundColor: '#7c3aed', filtered: false },
	{ symbol: '<', name: 'Scheduled', description: 'On the calendar', color: '#ffffff', backgroundColor: '#059669', filtered: false },
	{ symbol: '#', name: 'Backburner', description: 'Delayed', color: '#ffffff', backgroundColor: '#7c3aed', filtered: false },
	{ symbol: '-', name: 'Cancelled', description: 'Not doing', color: '#ffffff', backgroundColor: '#9ca3af', filtered: false }
];

export interface SettingsChangeEvent<K extends keyof OnTaskSettings = keyof OnTaskSettings> {
	key: K;
	value: OnTaskSettings[K];
	oldValue: OnTaskSettings[K];
}

export interface SettingsService {
	initialize(): Promise<void>;
	getSettings(): OnTaskSettings;
	updateSetting<K extends keyof OnTaskSettings>(key: K, value: OnTaskSettings[K]): Promise<void>;
	updateSettings(updates: Partial<OnTaskSettings>): Promise<void>;
	resetToDefaults(): Promise<void>;
	onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void;
	isDailyNotesAvailable(): boolean;
}
