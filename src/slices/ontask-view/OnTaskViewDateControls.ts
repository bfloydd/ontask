import { SettingsService } from '../settings';
import { EventSystem } from '../events';
import { Logger } from '../logging/Logger';
import { IconService } from '../../shared/IconService';
import { DateFilterService, DateFilterId } from './date-filter';

/**
 * Date filter control utility class for OnTaskView that manages
 * the date filter UI (Today/All toggle buttons).
 */
export class OnTaskViewDateControls {
	private dateFilterControl: HTMLElement | null = null;
	private dateFilterButtons: Map<string, HTMLButtonElement> = new Map();
	private onRefresh: (() => Promise<void>) | null = null;

	constructor(
		private settingsService: SettingsService,
		private dateFilterService: DateFilterService,
		private eventSystem: EventSystem,
		private logger: Logger
	) {}

	/**
	 * Creates the date filter control UI in the specified container
	 */
	createDateFilterControl(container: HTMLElement, onRefresh: () => Promise<void>): void {
		this.onRefresh = onRefresh;
		this.dateFilterControl = container.createDiv('ontask-segmented-control');
		
		const options = this.dateFilterService.getAll();
		
		options.forEach((option) => {
			const button = this.dateFilterControl!.createEl('button', {
				cls: 'ontask-segmented-button',
				attr: { 'data-value': option.id }
			});
			
			// Append icon element using Obsidian's icon system
			const iconElement = IconService.getIconElement(option.icon);
			if (iconElement) {
				button.appendChild(iconElement);
			}
			
			// Append text label with space
			button.appendChild(activeDocument.createTextNode(' ' + option.label));
			
			button.addEventListener('click', () => { void this.setDateFilter(option.id); }, { passive: true });
			
			this.dateFilterButtons.set(option.id, button);
		});
		
		this.updateDateFilterState();
	}

	/**
	 * Sets the date filter value and triggers a refresh callback
	 */
	private async setDateFilter(value: DateFilterId): Promise<void> {
		await this.settingsService.updateSetting('dateFilter', value);
		this.updateDateFilterState();
		if (this.onRefresh) {
			await this.onRefresh();
		}
	}

	/**
	 * Updates the visual state of the date filter buttons based on current settings
	 */
	updateDateFilterState(): void {
		const settings = this.settingsService.getSettings();
		
		this.dateFilterButtons.forEach((button, value) => {
			if (settings.dateFilter === value) {
				button.classList.add('is-active');
			} else {
				button.classList.remove('is-active');
			}
		});
	}

	/**
	 * Toggles the top task visibility (for future use)
	 */
	toggleTopTaskVisibility(): void {
		this.logger.debug('[OnTask View] Emitting ui:toggle-top-task-visibility event');
		this.eventSystem.emit('ui:toggle-top-task-visibility', {});
	}
}

