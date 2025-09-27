// Event system slice - Service implementation
import { EventSystem, EventCallback, EventSubscription, EventData } from './event-system-interface';

interface EventListener {
	id: string;
	callback: EventCallback;
	once: boolean;
}

export class EventSystemServiceImpl implements EventSystem {
	private listeners: Map<string, EventListener[]> = new Map();
	private listenerIdCounter = 0;

	on<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription {
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

		return {
			unsubscribe: () => this.removeListener(eventName, id)
		};
	}

	once<T = any>(eventName: string, callback: EventCallback<T>): EventSubscription {
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

		return {
			unsubscribe: () => this.removeListener(eventName, id)
		};
	}

	emit<T = any>(eventName: string, data?: T): void {
		const eventListeners = this.listeners.get(eventName);
		if (!eventListeners || eventListeners.length === 0) {
			return;
		}

		const eventData: EventData = {
			timestamp: Date.now(),
			source: 'event-system',
			data
		};

		// Create a copy of listeners to avoid issues with modifications during iteration
		const listenersToCall = [...eventListeners];

		for (const listener of listenersToCall) {
			try {
				const result = listener.callback(eventData);
				
				// Handle async callbacks
				if (result instanceof Promise) {
					result.catch(error => {
						console.error(`Error in event listener for ${eventName}:`, error);
					});
				}

				// Remove one-time listeners
				if (listener.once) {
					this.removeListener(eventName, listener.id);
				}
			} catch (error) {
				console.error(`Error in event listener for ${eventName}:`, error);
			}
		}
	}

	async emitAsync<T = any>(eventName: string, data?: T): Promise<void> {
		const eventListeners = this.listeners.get(eventName);
		if (!eventListeners || eventListeners.length === 0) {
			return;
		}

		const eventData: EventData = {
			timestamp: Date.now(),
			source: 'event-system',
			data
		};

		// Create a copy of listeners to avoid issues with modifications during iteration
		const listenersToCall = [...eventListeners];
		const promises: Promise<void>[] = [];

		for (const listener of listenersToCall) {
			try {
				const result = listener.callback(eventData);
				
				// Handle both sync and async callbacks
				if (result instanceof Promise) {
					promises.push(
						result.catch(error => {
							console.error(`Error in async event listener for ${eventName}:`, error);
						})
					);
				}

				// Remove one-time listeners
				if (listener.once) {
					this.removeListener(eventName, listener.id);
				}
			} catch (error) {
				console.error(`Error in event listener for ${eventName}:`, error);
			}
		}

		// Wait for all async listeners to complete
		await Promise.all(promises);
	}

	off(eventName: string): void {
		this.listeners.delete(eventName);
	}

	clear(): void {
		this.listeners.clear();
	}

	listenerCount(eventName: string): number {
		const listeners = this.listeners.get(eventName);
		return listeners ? listeners.length : 0;
	}

	getEventNames(): string[] {
		return Array.from(this.listeners.keys());
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
				// Remove the event name if no listeners remain
				if (listeners.length === 0) {
					this.listeners.delete(eventName);
				}
			}
		}
	}
}
