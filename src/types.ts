// Shared types for the OnTask plugin

// Re-export settings from settings slice
export type { OnTaskSettings } from './slices/settings';
export { DEFAULT_SETTINGS } from './slices/settings';

export interface Stream {
	name: string;
	path: string;
}
