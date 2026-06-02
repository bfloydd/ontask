import { DayPlanResult } from '../day-planner/DayPlannerService';

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
	dateFilter: 'all' | 'today' | 'week';
	topTaskColor: string;
	useThemeDefaultColor: boolean;
	showTopTaskInStatusBar: boolean;
	checkboxSource: 'streams' | 'daily-notes' | 'folder';
	customFolderPath: string;
	includeSubfolders: boolean;
	loadMoreLimit: number;
	hideCompletedTasks: boolean;
	debugLoggingEnabled: boolean;
	viewStyle: 'default' | 'alt1' | 'modern';
	dayPlannerPrompt: string;
	dayPlannerSchedule: string;
	dayPlannerScheduleFromNow: boolean;
	dayPlannerStartTime: string;
	dayPlannerEndTime: string;
	geminiApiKey: string;
	geminiModel: string;
	lastDayPlan: DayPlanResult | null;
}

export const DEFAULT_SETTINGS: OnTaskSettings = {
	dateFilter: 'all',
	topTaskColor: '#ff6b6b',
	useThemeDefaultColor: true,
	showTopTaskInStatusBar: false,
	checkboxSource: 'daily-notes',
	customFolderPath: '',
	includeSubfolders: true,
	loadMoreLimit: 10,
	hideCompletedTasks: false,
	debugLoggingEnabled: false,
	viewStyle: 'default',
	dayPlannerPrompt: 'How would my Todo list fit into this neatly given each todo item\'s description and time the task will take? Organizing properly for my day. Also consider:\n- My task priorities based on statues (and the status\' criticality).\n- Real world descriptions like "do it early in the day" or "urgent" to prioritize and put into the correct time slots.\n- Only give the final checklist reorganized, but include a time of day for each task as a header\n- If the todo list takes longer than the time given in my schedule, then mention it and just do what we can, properly balancing in important tasks with what can actually be accomplished.',
	dayPlannerSchedule: '',
	dayPlannerScheduleFromNow: true,
	dayPlannerStartTime: '06:00 AM',
	dayPlannerEndTime: '10:00 PM',
	geminiApiKey: '',
	geminiModel: 'gemini-2.5-flash',
	lastDayPlan: null
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
	{ symbol: 'b', name: 'Blocked', description: 'Can\'t continue', color: '#ffffff', backgroundColor: '#dc2626', filtered: true },
	{ symbol: '>', name: 'Forward', description: 'Tomorrow', color: '#ffffff', backgroundColor: '#7c3aed', filtered: true },
	{ symbol: '<', name: 'Scheduled', description: 'On the calendar', color: '#ffffff', backgroundColor: '#059669', filtered: false },
	{ symbol: '#', name: 'Backburner', description: 'Active, delayed', color: '#ffffff', backgroundColor: '#7c3aed', filtered: false, topTaskRanking: 5 },
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
