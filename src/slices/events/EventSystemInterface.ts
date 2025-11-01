import { SettingsChangeEvent } from '../settings/SettingsServiceInterface';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export type EventCallback<T = unknown> = (data: T) => void | Promise<void>;

export interface EventSubscription {
	unsubscribe(): void;
}

export interface EventSystem {
	on<T = unknown>(eventName: string, callback: EventCallback<T>): EventSubscription;
	once<T = unknown>(eventName: string, callback: EventCallback<T>): EventSubscription;
	emit<T = unknown>(eventName: string, data?: T): void;
	emitAsync<T = unknown>(eventName: string, data?: T): Promise<void>;
	clear(): void;
}

export interface EventData<T = unknown> {
	timestamp: number;
	source: string;
	data: T | undefined;
}

export interface OnTaskEvents {
	'settings:changed': SettingsChangeEvent;
	'checkboxes:found': {
		count: number;
		source: string;
	};
	'checkboxes:updated': {
		count: number;
		topTask?: CheckboxItem;
	};
	'ui:view-opened': {
		viewType: string;
	};
	'ui:view-closed': {
		viewType: string;
	};
	'plugin:initialized': {};
	'plugin:shutdown': {};
	'plugin:error': {
		error: Error;
		context: string;
	};
	'streams:ready': {};
	'streams:changed': {
		count: number;
	};
	'file:modified': {
		path: string;
	};
	'file:created': {
		path: string;
	};
	'file:deleted': {
		path: string;
	};
}
