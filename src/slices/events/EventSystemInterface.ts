export type EventCallback<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
	unsubscribe(): void;
}

export interface EventSystem {
	on<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription;
	once<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription;
	emit<T = any>(eventName: string, data?: T): void;
	emitAsync<T = any>(eventName: string, data?: T): Promise<void>;
	clear(): void;
}

export interface EventData {
	timestamp: number;
	source: string;
	data: any;
}

export interface OnTaskEvents {
	'settings:changed': {
		key: string;
		value: any;
		oldValue: any;
	};
	'checkboxes:found': {
		count: number;
		source: string;
	};
	'checkboxes:updated': {
		count: number;
		topTask?: any;
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
