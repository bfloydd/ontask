import { EventSystem } from '../../events';
import { ItemView } from 'obsidian';
import { Logger } from '../../logging/Logger';

export interface EventHandlingServiceInterface {
	setupEventListeners(): void;
	cleanupEventListeners(): void;
}

export class EventHandlingService implements EventHandlingServiceInterface {
	private eventSystem: EventSystem;
	private app: any;
	private checkboxes: any[];
	private isUpdatingStatus: boolean;
	private onRefreshCheckboxes: () => Promise<void>;
	private onUpdateTopTaskSection: (contentArea: HTMLElement, checkboxes: any[]) => void;
	private onScheduleDebouncedRefresh: (file: any) => void;
	private eventListeners: (() => void)[] = [];
	private logger: Logger;

	constructor(
		eventSystem: EventSystem,
		app: any,
		checkboxes: any[],
		isUpdatingStatus: boolean,
		onRefreshCheckboxes: () => Promise<void>,
		onUpdateTopTaskSection: (contentArea: HTMLElement, checkboxes: any[]) => void,
		onScheduleDebouncedRefresh: (file: any) => void,
		logger: Logger
	) {
		this.eventSystem = eventSystem;
		this.app = app;
		this.checkboxes = checkboxes;
		this.isUpdatingStatus = isUpdatingStatus;
		this.onRefreshCheckboxes = onRefreshCheckboxes;
		this.onUpdateTopTaskSection = onUpdateTopTaskSection;
		this.onScheduleDebouncedRefresh = onScheduleDebouncedRefresh;
		this.logger = logger;
	}

	setupEventListeners(): void {
		
		// Clean up any existing listeners first
		this.cleanupEventListeners();
		
		// Listen for settings changes
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			this.logger.debug('[OnTask EventHandling] Settings changed event received:', event.data);
			if (event.data.key === 'onlyShowToday') {
				this.logger.debug('[OnTask EventHandling] onlyShowToday setting changed, refreshing checkboxes');
				this.onRefreshCheckboxes();
			}
		});
		
		// Listen for checkbox updates to update top task section immediately
		const checkboxUpdateSubscription = this.eventSystem.on('checkboxes:updated', (event) => {
			this.logger.debug('[OnTask EventHandling] Checkboxes updated event received:', event.data);
			// Only update the top task section without full refresh
			const contentArea = this.app.workspace.getActiveViewOfType(ItemView)?.contentEl?.querySelector('.ontask-content') as HTMLElement;
			if (contentArea) {
				this.logger.debug('[OnTask EventHandling] Updating top task section');
				this.onUpdateTopTaskSection(contentArea, this.checkboxes);
			} else {
				this.logger.debug('[OnTask EventHandling] No content area found for top task section update');
			}
		});
		
		// Editor events disabled - no longer listening for file modifications
		
		// Store cleanup functions
		this.eventListeners = [
			() => settingsSubscription.unsubscribe(),
			() => checkboxUpdateSubscription.unsubscribe()
		];
	}

	cleanupEventListeners(): void {
		if (this.eventListeners) {
			this.eventListeners.forEach(cleanup => cleanup());
			this.eventListeners = [];
		}
	}

	// Method to update references when checkboxes or isUpdatingStatus change
	updateReferences(checkboxes: any[], isUpdatingStatus: boolean): void {
		this.checkboxes = checkboxes;
		this.isUpdatingStatus = isUpdatingStatus;
	}
}
