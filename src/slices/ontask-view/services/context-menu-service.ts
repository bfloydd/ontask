import { EventSystem } from '../../events';
import { StatusConfigService } from '../../settings/status-config';
import { Menu, Modal, App } from 'obsidian';

export interface ContextMenuServiceInterface {
	showContextMenu(event: MouseEvent, checkbox: any): void;
	showFiltersMenu(): void;
}

class FilterModal extends Modal {
	private statusConfigService: StatusConfigService;
	private settingsService: any;
	private dataService: any;
	private refreshCheckboxesCallback: () => Promise<void>;
	private resetTrackingCallback: () => void;
	private statusConfigs: any[];

	constructor(
		app: App,
		statusConfigService: StatusConfigService,
		settingsService: any,
		dataService: any,
		refreshCheckboxesCallback: () => Promise<void>,
		resetTrackingCallback: () => void
	) {
		super(app);
		this.statusConfigService = statusConfigService;
		this.settingsService = settingsService;
		this.dataService = dataService;
		this.refreshCheckboxesCallback = refreshCheckboxesCallback;
		this.resetTrackingCallback = resetTrackingCallback;
		this.statusConfigs = this.statusConfigService.getStatusConfigs();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ontask-filters-modal');

		// Title
		const title = contentEl.createEl('h2', { text: 'Filter Statuses' });
		
		// Status checkboxes
		const checkboxesContainer = contentEl.createDiv('ontask-filters-checkboxes-container');
		const checkboxElements: { [key: string]: HTMLInputElement } = {};

		for (const status of this.statusConfigs) {
			const checkboxItem = this.createStatusCheckboxItem(status, checkboxElements);
			checkboxesContainer.appendChild(checkboxItem);
		}

		// Quick filters section
		const quickFilters = this.dataService.getQuickFilters().filter((filter: any) => filter.enabled);
		if (quickFilters.length > 0) {
			contentEl.createEl('hr');
			const quickFiltersContainer = contentEl.createDiv('ontask-filters-quick-filters-container');
			quickFilters.forEach((filter: any) => {
				const button = this.createQuickFilterButton(filter, checkboxElements);
				quickFiltersContainer.appendChild(button);
			});
		}

		// Buttons
		const buttonsContainer = contentEl.createDiv('ontask-filters-buttons-container');
		const saveButton = buttonsContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			await this.saveFilterSettings(checkboxElements);
		}, { passive: true });

		const cancelButton = buttonsContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		}, { passive: true });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createStatusCheckboxItem(status: any, checkboxElements: { [key: string]: HTMLInputElement }): HTMLElement {
		const checkboxItem = document.createElement('div');
		checkboxItem.className = 'ontask-filters-checkbox-item';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = `filter-${status.symbol}`;
		checkbox.checked = status.filtered !== false;
		checkboxElements[status.symbol] = checkbox;

		const statusDisplay = this.createStatusDisplay(status);
		const label = this.createStatusLabel(status, checkbox);

		checkboxItem.appendChild(checkbox);
		checkboxItem.appendChild(statusDisplay);
		checkboxItem.appendChild(label);

		checkboxItem.addEventListener('click', (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
			}
		}, { passive: true });

		return checkboxItem;
	}

	private createStatusDisplay(status: any): HTMLElement {
		const statusDisplay = document.createElement('div');
		statusDisplay.className = 'ontask-checkbox-display';
		statusDisplay.setAttribute('data-status', status.symbol);
		statusDisplay.textContent = status.symbol;
		statusDisplay.style.setProperty('--ontask-status-color', status.color);
		statusDisplay.style.setProperty('--ontask-status-background-color', status.backgroundColor || 'transparent');
		
		const isBuiltInStatus = ['x', '!', '?', '*', 'r', 'b', '<', '>', '-', '/', '+', '.', '#'].includes(status.symbol);
		if (!isBuiltInStatus) {
			statusDisplay.setAttribute('data-dynamic-color', 'true');
			statusDisplay.setAttribute('data-custom-status', 'true');
		}

		return statusDisplay;
	}

	private createStatusLabel(status: any, checkbox: HTMLInputElement): HTMLElement {
		const label = document.createElement('label');
		label.htmlFor = `filter-${status.symbol}`;
		label.className = 'ontask-filters-checkbox-label';

		const nameEl = label.createEl('div', { text: status.name });
		nameEl.className = 'ontask-filters-checkbox-name';

		const descEl = label.createEl('div', { text: status.description });
		descEl.className = 'ontask-filters-checkbox-description';

		return label;
	}

	private createQuickFilterButton(filter: any, checkboxElements: { [key: string]: HTMLInputElement }): HTMLElement {
		const button = document.createElement('button');
		button.textContent = filter.name;
		button.className = 'ontask-quick-filter-button';

		button.addEventListener('click', () => {
			filter.statusSymbols.forEach((symbol: string) => {
				const checkbox = checkboxElements[symbol];
				if (checkbox) {
					checkbox.checked = true;
				}
			});

			Object.keys(checkboxElements).forEach(symbol => {
				if (!filter.statusSymbols.includes(symbol)) {
					checkboxElements[symbol].checked = false;
				}
			});
		}, { passive: true });

		return button;
	}

	private async saveFilterSettings(checkboxElements: { [key: string]: HTMLInputElement }): Promise<void> {
		for (const [symbol, checkbox] of Object.entries(checkboxElements)) {
			await this.statusConfigService.updateStatusFiltered(symbol, checkbox.checked);
		}
		
		this.resetTrackingCallback();
		await this.refreshCheckboxesCallback();
		this.close();
	}
}

export class ContextMenuService implements ContextMenuServiceInterface {
	private eventSystem: EventSystem;
	private statusConfigService: StatusConfigService;
	private settingsService: any;
	private dataService: any;
	private contentEl: HTMLElement;
	private updateCheckboxStatusCallback: (checkbox: any, newStatus: string) => Promise<void>;
	private refreshCheckboxesCallback: () => Promise<void>;
	private resetTrackingCallback: () => void;
	private filterModal: FilterModal | null = null;
	private app: App;

	constructor(
		app: App,
		eventSystem: EventSystem,
		statusConfigService: StatusConfigService,
		settingsService: any,
		dataService: any,
		contentEl: HTMLElement,
		updateCheckboxStatusCallback: (checkbox: any, newStatus: string) => Promise<void>,
		refreshCheckboxesCallback: () => Promise<void>,
		resetTrackingCallback: () => void
	) {
		this.app = app;
		this.eventSystem = eventSystem;
		this.statusConfigService = statusConfigService;
		this.settingsService = settingsService;
		this.dataService = dataService;
		this.contentEl = contentEl;
		this.updateCheckboxStatusCallback = updateCheckboxStatusCallback;
		this.refreshCheckboxesCallback = refreshCheckboxesCallback;
		this.resetTrackingCallback = resetTrackingCallback;
	}

	showContextMenu(event: MouseEvent, checkbox: any): void {
		const menu = new Menu();
		const statuses = this.statusConfigService.getStatusConfigs();

		for (const status of statuses) {
			menu.addItem((item) => {
				// Set title with status symbol and name
				item.setTitle(status.name)
					.setChecked(false)
					.onClick(async () => {
						await this.updateCheckboxStatusCallback(checkbox, status.symbol);
					});

				// Access the menu item's DOM to precisely control appearance
				const menuEl = (item as any).dom as HTMLElement;
				if (menuEl) {
					// Create a styled status display element
					const statusDisplay = document.createElement('span');
					statusDisplay.className = 'ontask-context-menu-status-display';
					statusDisplay.textContent = status.symbol;
					statusDisplay.style.setProperty('--ontask-status-color', status.color);
					statusDisplay.style.setProperty('--ontask-status-background-color', status.backgroundColor || 'transparent');
					
					const isBuiltInStatus = ['x', '!', '?', '*', 'r', 'b', '<', '>', '-', '/', '+', '.', '#'].includes(status.symbol);
					if (!isBuiltInStatus) {
						statusDisplay.setAttribute('data-dynamic-color', 'true');
						statusDisplay.setAttribute('data-custom-status', 'true');
					}
					
					// Find the title element in the menu item
					const titleEl = menuEl.querySelector('.menu-item-title');
					if (titleEl) {
						titleEl.insertBefore(statusDisplay, titleEl.firstChild);
					}
				}
			});
		}

		menu.showAtMouseEvent(event);
	}

	showFiltersMenu(): void {
		if (this.filterModal) {
			this.filterModal.close();
			this.filterModal = null;
			return;
		}

		this.filterModal = new FilterModal(
			this.app,
			this.statusConfigService,
			this.settingsService,
			this.dataService,
			this.refreshCheckboxesCallback,
			this.resetTrackingCallback
		);
		this.filterModal.open();
	}
}

