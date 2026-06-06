import { App, Plugin } from 'obsidian';

export interface DailyNotesOptions {
	folder?: string;
}

export interface DailyNotesInstance {
	options?: DailyNotesOptions;
}

export interface InternalPlugin {
	enabled: boolean;
	instance?: DailyNotesInstance;
}

export interface InternalPlugins {
	plugins: Record<string, InternalPlugin | undefined>;
}

export interface CommunityPlugins {
	getPlugin(id: string): Plugin | null;
}

export interface AppWithPlugins extends App {
	internalPlugins?: InternalPlugins;
	plugins?: CommunityPlugins;
}

export interface OnTaskPlugin extends Plugin {
	settingsTab?: {
		navigateToTab(tabId: string): void;
	};
}
