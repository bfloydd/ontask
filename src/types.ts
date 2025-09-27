// Shared types for the OnTask plugin

export interface OnTaskSettings {
	hideCompletedTasks: boolean;
	onlyShowToday: boolean;
	topTaskColor: string;
	showTopTaskInStatusBar: boolean;
}

export interface Stream {
	name: string;
	path: string;
}
