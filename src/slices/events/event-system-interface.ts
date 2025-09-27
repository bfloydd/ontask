// Event system slice - Interface definitions

export type EventCallback<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
	unsubscribe(): void;
}

export interface EventSystem {
	// Subscribe to events
	on<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription;
	
	// Subscribe to events once
	once<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription;
	
	// Emit events
	emit<T = any>(eventName: string, data?: T): void;
	
	// Emit events asynchronously
	emitAsync<T = any>(eventName: string, data?: T): Promise<void>;
	
	// Remove all listeners for an event
	off(eventName: string): void;
	
	// Remove all listeners
	clear(): void;
	
	// Get listener count for an event
	listenerCount(eventName: string): number;
	
	// Get all event names
	getEventNames(): string[];
}

export interface EventData {
	timestamp: number;
	source: string;
	data: any;
}

// Predefined event types for type safety
export interface OnTaskEvents {
	// Settings events
	'settings:changed': {
		key: string;
		value: any;
		oldValue: any;
	};
	
	// Checkbox events
	'checkboxes:found': {
		count: number;
		source: string;
	};
	'checkboxes:updated': {
		count: number;
		topTask?: any;
	};
	
	// UI events
	'ui:view-opened': {
		viewType: string;
	};
	'ui:view-closed': {
		viewType: string;
	};
	'ui:status-bar-updated': {
		visible: boolean;
		text?: string;
	};
	
	// Plugin events
	'plugin:initialized': {};
	'plugin:shutdown': {};
	'plugin:error': {
		error: Error;
		context: string;
	};
	
	// Streams events
	'streams:ready': {};
	'streams:changed': {
		count: number;
	};
	
	// File events
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
