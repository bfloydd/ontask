import { EventSystem } from '../events';
import { ItemView } from 'obsidian';

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

	constructor(
		eventSystem: EventSystem,
		app: any,
		checkboxes: any[],
		isUpdatingStatus: boolean,
		onRefreshCheckboxes: () => Promise<void>,
		onUpdateTopTaskSection: (contentArea: HTMLElement, checkboxes: any[]) => void,
		onScheduleDebouncedRefresh: (file: any) => void
	) {
		this.eventSystem = eventSystem;
		this.app = app;
		this.checkboxes = checkboxes;
		this.isUpdatingStatus = isUpdatingStatus;
		this.onRefreshCheckboxes = onRefreshCheckboxes;
		this.onUpdateTopTaskSection = onUpdateTopTaskSection;
		this.onScheduleDebouncedRefresh = onScheduleDebouncedRefresh;
	}

	setupEventListeners(): void {
		console.log('EventHandlingService: Setting up event listeners');
		
		// Clean up any existing listeners first
		this.cleanupEventListeners();
		
		// Listen for settings changes
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			console.log('EventHandlingService: Settings changed event received:', event.data.key);
			if (event.data.key === 'onlyShowToday') {
				console.log('EventHandlingService: Triggering refresh due to settings change');
				this.onRefreshCheckboxes();
			}
		});
		
		// Listen for checkbox updates to update top task section immediately
		const checkboxUpdateSubscription = this.eventSystem.on('checkboxes:updated', (event) => {
			console.log('EventHandlingService: Checkboxes updated event received, updating top task section');
			// Only update the top task section without full refresh
			const contentArea = this.app.workspace.getActiveViewOfType(ItemView)?.contentEl?.querySelector('.ontask-content') as HTMLElement;
			if (contentArea) {
				this.onUpdateTopTaskSection(contentArea, this.checkboxes);
			}
		});
		
		// Listen for file modifications
		const fileModifyListener = (file: any) => {
			// Skip refresh if we're currently updating a status ourselves
			if (this.isUpdatingStatus) {
				console.log('EventHandlingService: Skipping refresh - currently updating status');
				return;
			}
			
			// Only process markdown files
			if (!file.path.endsWith('.md')) {
				return;
			}
			
			// Check if any of our checkboxes are in this file
			const isRelevantFile = this.checkboxes.some(checkbox => checkbox.file?.path === file.path);
			if (isRelevantFile) {
				// Only process if we have checkboxes in this file
				this.onScheduleDebouncedRefresh(file);
			}
		};
		
		this.app.vault.on('modify', fileModifyListener);
		
		// Store cleanup functions
		this.eventListeners = [
			() => settingsSubscription.unsubscribe(),
			() => checkboxUpdateSubscription.unsubscribe(),
			() => this.app.vault.off('modify', fileModifyListener)
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
