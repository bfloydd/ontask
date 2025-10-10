import { ItemView, WorkspaceLeaf } from 'obsidian';

export interface OnTaskViewInterface {
	getViewType(): string;
	getDisplayText(): string;
	getIcon(): string;
	onOpen(): Promise<void>;
	onClose(): Promise<void>;
	refreshCheckboxes(): Promise<void>;
}

export const ONTASK_VIEW_TYPE = 'ontask-view';
