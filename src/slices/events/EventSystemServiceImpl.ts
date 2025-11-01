import { EventSystem, EventCallback, EventSubscription, EventData } from './EventSystemInterface';
import { Logger } from '../logging/Logger';

interface EventListener {
	id: string;
	callback: EventCallback;
	once: boolean;
}

export class EventSystemServiceImpl implements EventSystem {
	private listeners: Map<string, EventListener[]> = new Map();
	private listenerIdCounter = 0;
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	on<T = unknown>(eventName: string, callback: EventCallback<T>): EventSubscription {
		const id = this.generateListenerId();
		const listener: EventListener = {
			id,
			callback: callback as EventCallback,
			once: false
		};

		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, []);
		}
		this.listeners.get(eventName)!.push(listener);

		this.logger.debug(`Event subscription added: ${eventName} (ID: ${id})`);
		this.logger.debug(`Total listeners for ${eventName}: ${this.listeners.get(eventName)!.length}`);

		return {
			unsubscribe: () => this.removeListener(eventName, id)
		};
	}

	once<T = unknown>(eventName: string, callback: EventCallback<T>): EventSubscription {
		const id = this.generateListenerId();
		const listener: EventListener = {
			id,
			callback: callback as EventCallback,
			once: true
		};

		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, []);
		}
		this.listeners.get(eventName)!.push(listener);

		this.logger.debug(`Event subscription added (once): ${eventName} (ID: ${id})`);
		this.logger.debug(`Total listeners for ${eventName}: ${this.listeners.get(eventName)!.length}`);

		return {
			unsubscribe: () => this.removeListener(eventName, id)
		};
	}

	emit<T = unknown>(eventName: string, data?: T): void {
		const eventListeners = this.listeners.get(eventName);
		if (!eventListeners || eventListeners.length === 0) {
			this.logger.debug(`Event emitted but no listeners: ${eventName}`);
			return;
		}

		this.logger.debug(`Event emitted: ${eventName} to ${eventListeners.length} listeners`, data);

		const eventData: EventData<T> = {
			timestamp: Date.now(),
			source: 'event-system',
			data
		};

		const listenersToCall = [...eventListeners];

		for (const listener of listenersToCall) {
			try {
				this.logger.debug(`Calling listener for ${eventName} (ID: ${listener.id})`);
				const result = listener.callback(eventData);
				
				if (result instanceof Promise) {
					result.catch(error => {
						this.logger.error(`Error in async event listener for ${eventName} (ID: ${listener.id}):`, error);
					});
				}

				if (listener.once) {
					this.logger.debug(`Removing once listener for ${eventName} (ID: ${listener.id})`);
					this.removeListener(eventName, listener.id);
				}
			} catch (error) {
				this.logger.error(`Error in event listener for ${eventName} (ID: ${listener.id}):`, error);
			}
		}
	}

	async emitAsync<T = unknown>(eventName: string, data?: T): Promise<void> {
		const eventListeners = this.listeners.get(eventName);
		if (!eventListeners || eventListeners.length === 0) {
			this.logger.debug(`Async event emitted but no listeners: ${eventName}`);
			return;
		}

		this.logger.debug(`Async event emitted: ${eventName} to ${eventListeners.length} listeners`, data);

		const eventData: EventData<T> = {
			timestamp: Date.now(),
			source: 'event-system',
			data
		};

		const listenersToCall = [...eventListeners];
		const promises: Promise<void>[] = [];

		for (const listener of listenersToCall) {
			try {
				this.logger.debug(`Calling async listener for ${eventName} (ID: ${listener.id})`);
				const result = listener.callback(eventData);
				
				if (result instanceof Promise) {
					promises.push(
						result.catch(error => {
							this.logger.error(`Error in async event listener for ${eventName} (ID: ${listener.id}):`, error);
						})
					);
				}

				if (listener.once) {
					this.logger.debug(`Removing once async listener for ${eventName} (ID: ${listener.id})`);
					this.removeListener(eventName, listener.id);
				}
			} catch (error) {
				this.logger.error(`Error in async event listener for ${eventName} (ID: ${listener.id}):`, error);
			}
		}

		await Promise.all(promises);
	}


	clear(): void {
		this.listeners.clear();
	}


	private generateListenerId(): string {
		return `listener_${++this.listenerIdCounter}`;
	}

	private removeListener(eventName: string, listenerId: string): void {
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			const index = listeners.findIndex(l => l.id === listenerId);
			if (index > -1) {
				listeners.splice(index, 1);
				this.logger.debug(`Event listener removed: ${eventName} (ID: ${listenerId})`);
				if (listeners.length === 0) {
					this.listeners.delete(eventName);
					this.logger.debug(`No more listeners for ${eventName}, event removed`);
				} else {
					this.logger.debug(`Remaining listeners for ${eventName}: ${listeners.length}`);
				}
			} else {
				this.logger.debug(`Attempted to remove non-existent listener: ${eventName} (ID: ${listenerId})`);
			}
		} else {
			this.logger.debug(`Attempted to remove listener from non-existent event: ${eventName} (ID: ${listenerId})`);
		}
	}
}
