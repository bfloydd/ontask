export type { OnTaskSettings } from './slices/settings';
export { DEFAULT_SETTINGS } from './slices/settings';

import { App, Plugin } from 'obsidian';

/**
 * Extended App interface that includes plugins access.
 * Obsidian's App type doesn't publicly expose plugins, but it's available at runtime.
 */
export interface AppWithPlugins extends App {
	plugins?: {
		getPlugin(id: string): Plugin | null;
	};
	internalPlugins?: {
		plugins?: {
			[key: string]: {
				enabled?: boolean;
			};
		};
	};
}